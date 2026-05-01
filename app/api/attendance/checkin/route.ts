import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Attendance from '@/models/Attendance';
import { getAuthUser } from '@/lib/auth';
import {
  autoCloseMissedClockOut,
  getISTDateStr,
  getShiftRules,
  getStatusByShiftRules,
  recomputeAttendanceTotals,
} from '@/lib/attendance-utils';
import { notifyLateAlert } from '@/lib/system-notifications';

function fmtISTTimeLabel(date: Date) {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
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

    const OFFICE_LAT = 12.9348;
    const OFFICE_LNG = 77.6112;
    const OFFICE_RADIUS = 150;

    const haversine = (l1: number, n1: number, l2: number, n2: number) => {
      const R = 6371000;
      const dLat = (l2 - l1) * Math.PI / 180;
      const dLng = (n2 - n1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(l1 * Math.PI / 180) * Math.cos(l2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const dist = (lat && lng) ? haversine(lat, lng, OFFICE_LAT, OFFICE_LNG) : 999999;
    const inOffice = dist <= OFFICE_RADIUS;

    // Removed restriction: Allow clock-in even if outside office (recorded in inOffice flag)
    // if (!inOffice && type !== 'break_end') {
    //    return NextResponse.json({ ok: false, error: 'Outside office boundary. Attendance not allowed.' }, { status: 400 });
    // }

    if (!selfieImage && type !== 'break_end') {
       return NextResponse.json({ ok: false, error: 'Selfie verification is mandatory.' }, { status: 400 });
    }

    const date = getISTDateStr();
    let att = await Attendance.findOne({ employeeId: user.id, date });
    const now = new Date();
    const sessionType = type === 'field_return' ? 'field' : 'work';

    if (type === 'break_end') {
      if (!att || !att.isOnBreak) return NextResponse.json({ error: 'No active break to end' }, { status: 400 });
      const last = att.sessions?.[att.sessions.length - 1];
      if (last && !last.checkOut && last.type === 'break') {
        last.checkOut = now;
        last.minutes = Math.max(0, Math.floor((now.getTime() - new Date(last.checkIn).getTime()) / 60000));
      }
      att.sessions.push({ checkIn: now, checkOut: null, type: 'work', minutes: 0, workMinutes: 0, lat: lat || null, lng: lng || null, inOffice });
      att.isCheckedIn = true;
      att.isOnBreak = false;
      att.workMode = 'Present';
      recomputeAttendanceTotals(att);
      att.markModified('sessions');
      await att.save();
      return NextResponse.json({ ok: true });
    }

    if (!att) {
      const rules = await getShiftRules();
      const status = getStatusByShiftRules(now, rules);
      att = new Attendance({
        employeeId: user.id,
        date,
        dayStatus: status.dayStatus,
        lateByMins: status.lateByMins,
        earlyByMins: status.earlyByMins,
        sessions: [{ checkIn: now, checkOut: null, type: sessionType, minutes: 0, workMinutes: 0, lat: lat || null, lng: lng || null, selfieImage, inOffice }],
        totalWorkMins: 0,
        totalBreakMins: 0,
        isCheckedIn: true,
        workMode: 'Present',
      });
    } else {
      att.sessions.push({ checkIn: now, checkOut: null, type: sessionType, minutes: 0, workMinutes: 0, lat: lat || null, lng: lng || null, selfieImage, inOffice });
      att.isCheckedIn = true;
      att.workMode = 'Present';
    }

    recomputeAttendanceTotals(att);
    att.markModified('sessions');
    await att.save();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
