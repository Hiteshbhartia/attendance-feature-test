import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Attendance from '@/models/Attendance';
import { getAuthUser } from '@/lib/auth';
import {
  autoCloseMissedClockOut,
  getISTDateStr,
  getShiftRules,
  applyUserSchedule,
  getStatusByShiftRules,
  recomputeAttendanceTotals,
} from '@/lib/attendance-utils';
import { notifyLateAlert } from '@/lib/system-notifications';
import User from '@/models/User';
import Tracker from '@/models/Tracker';

function fmtISTTimeLabel(date: Date) {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function getDefaultDailyCheckins() {
  return [
    { key: 'G1MYT', label: 'G1MYT', range: '10:30 AM - 12:00 PM', status: 'idle', targetCount: 0, progressNote: '', startedAt: '', completedAt: '', mytAdded: 0, toursInPipeline: 0, toursDone: 0, callsDone: 0, connected: 0, mytWhoWillPayToday: 0, tenantsPaid: 0, doubts: '', problems: '' },
    { key: 'G2MYT', label: 'G2MYT', range: '12:00 PM - 2:15 PM', status: 'idle', targetCount: 0, progressNote: '', startedAt: '', completedAt: '', mytAdded: 0, toursInPipeline: 0, toursDone: 0, callsDone: 0, connected: 0, mytWhoWillPayToday: 0, tenantsPaid: 0, doubts: '', problems: '' },
    { key: 'G3MYT', label: 'G3MYT', range: '2:30 PM - 4:00 PM', status: 'idle', targetCount: 0, progressNote: '', startedAt: '', completedAt: '', mytAdded: 0, toursInPipeline: 0, toursDone: 0, callsDone: 0, connected: 0, mytWhoWillPayToday: 0, tenantsPaid: 0, doubts: '', problems: '' },
    { key: 'G4MYT', label: 'G4MYT', range: '4:00 PM - 5:35 PM', status: 'idle', targetCount: 0, progressNote: '', startedAt: '', completedAt: '', mytAdded: 0, toursInPipeline: 0, toursDone: 0, callsDone: 0, connected: 0, mytWhoWillPayToday: 0, tenantsPaid: 0, doubts: '', problems: '' },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'admin') return NextResponse.json({ error: 'Admin cannot use attendance' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { lat, lng, type, selfieImage } = body;
    await connectDB();
    await autoCloseMissedClockOut(user.id);

    if (!selfieImage && type !== 'break_end' && type !== 'field_return') {
       return NextResponse.json({ ok: false, error: 'Selfie verification is mandatory.' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbUser = await User.findById(user.id).select('workSchedule officeZoneId').populate('officeZoneId').lean() as any;
    
    // ── Dynamic Geofencing (Zone-aware) ──
    const assignedZone = dbUser?.officeZoneId;
    const OFFICE_LAT = assignedZone?.lat || 12.9348;
    const OFFICE_LNG = assignedZone?.lng || 77.6112;
    const OFFICE_RADIUS = assignedZone?.radius || 150;

    const haversine = (l1: number, n1: number, l2: number, n2: number) => {
      const R = 6371000;
      const dLat = (l2 - l1) * Math.PI / 180;
      const dLng = (n2 - n1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(l1 * Math.PI / 180) * Math.cos(l2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const dist = (lat != null && lng != null) ? haversine(lat, lng, OFFICE_LAT, OFFICE_LNG) : 999999;
    const inOffice = dist <= OFFICE_RADIUS;
    const baseRules = await getShiftRules();
    const rules = applyUserSchedule(baseRules, dbUser?.workSchedule);

    const date = getISTDateStr();
    let att = await Attendance.findOne({ employeeId: user.id, date });

    // Ensure daily tracker record exists once employee clocks in
    const existingTracker = await Tracker.findOne({ employeeId: user.id, date });
    if (!existingTracker) {
      await Tracker.create({
        employeeId: user.id,
        date,
        role: user.role,
        initial: '',
        onIt: '',
        impact: '',
        notes: '',
        issues: '',
        dailyCheckins: getDefaultDailyCheckins(),
        submittedAt: null,
        isSubmitted: false,
        isEdited: false,
        submissionStatus: 'pending',
        completionScore: 0,
      });
    } else if (!Array.isArray(existingTracker.dailyCheckins) || existingTracker.dailyCheckins.length === 0) {
      existingTracker.dailyCheckins = getDefaultDailyCheckins();
      await existingTracker.save();
    }

    const now = new Date();
    const sessionType = type === 'field_return' ? 'field' : 'work';

    if (type === 'break_end') {
      if (!att || !att.isOnBreak) return NextResponse.json({ error: 'No active break to end' }, { status: 400 });
      const last = att.sessions?.[att.sessions.length - 1];
      if (last && !last.checkOut && last.type === 'break') {
        const mins = Math.max(0, Math.floor((now.getTime() - new Date(last.checkIn).getTime()) / 60000));
        last.checkOut = now;
        last.minutes = mins;
      }
      att.sessions.push({ checkIn: now, checkOut: null, type: 'work', minutes: 0, workMinutes: 0, lat: lat || null, lng: lng || null, inOffice, selfieImage });
      att.isCheckedIn = true;
      att.isOnBreak = false;
      att.workMode = 'Present';
      recomputeAttendanceTotals(att);
      att.markModified('sessions');
      await att.save();
      return NextResponse.json({ ok: true, checkInTime: now.toISOString(), action: 'break_end' });
    }

    if (type === 'field_return') {
      if (!att || !att.isInField) return NextResponse.json({ error: 'No active field visit to return from' }, { status: 400 });
      const last = att.sessions?.[att.sessions.length - 1];
      if (last && !last.checkOut && last.type === 'field') {
        const mins = Math.max(0, Math.floor((now.getTime() - new Date(last.checkIn).getTime()) / 60000));
        last.checkOut = now;
        last.minutes = mins;
        last.workMinutes = mins;
      }
      att.sessions.push({ checkIn: now, checkOut: null, type: 'work', minutes: 0, workMinutes: 0, lat: lat || null, lng: lng || null, inOffice, selfieImage });
      att.isCheckedIn = true;
      att.isInField = false;
      att.workMode = 'Present';
      recomputeAttendanceTotals(att);
      att.markModified('sessions');
      await att.save();
      return NextResponse.json({ ok: true, checkInTime: now.toISOString(), action: 'field_return' });
    }

    if (att?.isCheckedIn) return NextResponse.json({ error: 'Already checked in' }, { status: 400 });
    if (att?.isOnBreak) return NextResponse.json({ error: 'Break active. End break first.' }, { status: 400 });
    if (att?.isInField) return NextResponse.json({ error: 'Field visit active. Return first.' }, { status: 400 });

    if (!att) {
      const status = getStatusByShiftRules(now, rules);
      att = new Attendance({
        employeeId: user.id,
        date,
        dayStatus: status.dayStatus,
        lateByMins: status.lateByMins,
        earlyByMins: status.earlyByMins,
        sessions: [{ checkIn: now, checkOut: null, type: sessionType, minutes: 0, workMinutes: 0, lat: lat || null, lng: lng || null, inOffice, selfieImage }],
        totalWorkMins: 0,
        totalBreakMins: 0,
        isCheckedIn: true,
        isOnBreak: false,
        isInField: false,
        workMode: 'Present',
      });
    } else {
      att.sessions.push({ checkIn: now, checkOut: null, type: sessionType, minutes: 0, workMinutes: 0, lat: lat || null, lng: lng || null, inOffice, selfieImage });
      att.isCheckedIn = true;
      att.workMode = 'Present';
      if (att.sessions.length === 1) {
        const status = getStatusByShiftRules(now, rules);
        att.dayStatus = status.dayStatus;
        att.lateByMins = status.lateByMins;
        att.earlyByMins = status.earlyByMins;
      }
    }

    recomputeAttendanceTotals(att);
    att.markModified('sessions');
    await att.save();

    if (att.dayStatus === 'Late') {
      await notifyLateAlert({
        employeeId: user.id,
        employeeName: user.fullName || user.email || 'Employee',
        date,
        clockInLabel: fmtISTTimeLabel(now),
        lateByMins: Number(att.lateByMins || 0),
        shiftStart: rules.shiftStart,
        graceMinutes: Number(rules.graceMinutes || 0),
      });
    }

    return NextResponse.json({
      ok: true,
      checkInTime: now.toISOString(),
      dayStatus: att.dayStatus,
      lateByMins: att.lateByMins || 0,
      earlyByMins: att.earlyByMins || 0,
    });
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
