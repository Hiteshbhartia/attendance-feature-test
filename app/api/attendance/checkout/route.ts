import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import { getISTDateStr, recomputeAttendanceTotals } from '@/lib/attendance-utils';
import { notifyDailySummary } from '@/lib/system-notifications';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'admin') return NextResponse.json({ error: 'Admin cannot use attendance' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { lat, lng, type, selfieImage } = body;
    await connectDB();

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

    // Removed restriction: Allow clock-out even if outside office (recorded in inOffice flag)
    // if (!inOffice && type !== 'break_start') {
    //    return NextResponse.json({ ok: false, error: 'Outside office boundary. Attendance not allowed.' }, { status: 400 });
    // }

    if (!selfieImage && !type) { // Mandatory for final clock out (type is undefined/null)
       return NextResponse.json({ ok: false, error: 'Selfie verification is mandatory for clock out.' }, { status: 400 });
    }

    const date = getISTDateStr();
    const att = await Attendance.findOne({ employeeId: user.id, date });

    if (!att) return NextResponse.json({ error: 'No attendance record for today' }, { status: 400 });

    const now = new Date();
    const lastSession = att.sessions[att.sessions.length - 1];
    let finalClockOut = false;

    const closeOpen = () => {
      if (!lastSession || lastSession.checkOut) return 0;
      const mins = Math.max(0, Math.floor((now.getTime() - new Date(lastSession.checkIn).getTime()) / 60000));
      lastSession.checkOut = now;
      lastSession.minutes = mins;
      if (lastSession.type !== 'break') lastSession.workMinutes = mins;
      
      // Update session with final coords and selfie
      lastSession.lat = lat || null;
      lastSession.lng = lng || null;
      lastSession.inOffice = inOffice;
      if (selfieImage) lastSession.selfieImage = selfieImage;
      
      return mins;
    };

    if (type === 'break_start') {
      if (!att.isCheckedIn) return NextResponse.json({ error: 'Clock in first to start break' }, { status: 400 });
      closeOpen();
      att.sessions.push({ checkIn: now, checkOut: null, type: 'break', minutes: 0, workMinutes: 0, lat: lat || null, lng: lng || null, inOffice });
      att.isCheckedIn = false;
      att.isOnBreak = true;
      att.isInField = false;
      att.workMode = 'Break';
    } else if (type === 'field_exit') {
      if (!att.isCheckedIn) return NextResponse.json({ error: 'Clock in first to start field visit' }, { status: 400 });
      closeOpen();
      att.sessions.push({ checkIn: now, checkOut: null, type: 'field', minutes: 0, workMinutes: 0, lat: lat || null, lng: lng || null, inOffice });
      att.isCheckedIn = false;
      att.isOnBreak = false;
      att.isInField = true;
      att.workMode = 'Field';
    } else {
      if (att.isOnBreak) return NextResponse.json({ error: 'End break first before clocking out' }, { status: 400 });
      if (att.isInField) return NextResponse.json({ error: 'Return from field first before clocking out' }, { status: 400 });
      if (!att.isCheckedIn) return NextResponse.json({ error: 'Not checked in' }, { status: 400 });
      closeOpen();
      att.isCheckedIn = false;
      att.isOnBreak = false;
      att.isInField = false;
      att.workMode = 'Present';
      finalClockOut = true;
    }

    recomputeAttendanceTotals(att);
    att.markModified('sessions');
    await att.save();

    if (finalClockOut) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emp = await User.findById(user.id, 'fullName').lean() as any;
      await notifyDailySummary({
        employeeId: user.id,
        employeeName: emp?.fullName || user.fullName || 'Employee',
        date,
        totalWorkMins: Number(att.totalWorkMins || 0),
        totalBreakMins: Number(att.totalBreakMins || 0),
        dayStatus: String(att.dayStatus || 'Absent'),
        lateByMins: Number(att.lateByMins || 0),
        earlyByMins: Number(att.earlyByMins || 0),
      });
    }

    return NextResponse.json({
      ok: true,
      checkOutTime: now.toISOString(),
      totalWorkMins: att.totalWorkMins,
      totalBreakMins: att.totalBreakMins || 0,
      workMode: att.workMode,
    });
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
