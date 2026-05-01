import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import { getISTDateStr, recomputeAttendanceTotals } from '@/lib/attendance-utils';
import { notifyDailySummary } from '@/lib/system-notifications';

const OFFICE = { lat: 12.9716, lng: 77.5946 };
const RADIUS = 150;

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'admin') return NextResponse.json({ error: 'Admin cannot use attendance' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const type = body?.type as string | undefined;
    
    let inOffice = false;
    if (body?.lat != null && body?.lng != null) {
      const dist = getDistanceFromLatLonInM(body.lat, body.lng, OFFICE.lat, OFFICE.lng);
      inOffice = dist <= RADIUS;
    }

    await connectDB();

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
      return mins;
    };

    if (type === 'break_start') {
      if (!att.isCheckedIn) return NextResponse.json({ error: 'Clock in first to start break' }, { status: 400 });
      closeOpen();
      att.sessions.push({ checkIn: now, checkOut: null, type: 'break', minutes: 0, workMinutes: 0, lat: body?.lat || null, lng: body?.lng || null, selfieImage: body?.selfieImage || null, inOffice });
      att.isCheckedIn = false;
      att.isOnBreak = true;
      att.isInField = false;
      att.workMode = 'Break';
    } else if (type === 'field_exit') {
      if (!att.isCheckedIn) return NextResponse.json({ error: 'Clock in first to start field visit' }, { status: 400 });
      closeOpen();
      att.sessions.push({ checkIn: now, checkOut: null, type: 'field', minutes: 0, workMinutes: 0, lat: body?.lat || null, lng: body?.lng || null, selfieImage: body?.selfieImage || null, inOffice });
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
