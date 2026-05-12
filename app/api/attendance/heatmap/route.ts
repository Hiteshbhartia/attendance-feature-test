import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import OfficeZone from '@/models/OfficeZone';
import { getAuthUser } from '@/lib/auth';
import { applyUserSchedule, deriveStatusFromAttendance, getISTDateStr, getShiftRules } from '@/lib/attendance-utils';
import { IST_OFFSET_MS } from '@/lib/constants';

const IST_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
};

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-IN', IST_TIME_OPTIONS);
}

function getISTNow() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function getTodayIST() {
  return getISTNow().toISOString().split('T')[0];
}

function statusSortOrder(status: string): number {
  if (status === 'Early')   return 0;
  if (status === 'On Time') return 1;
  if (status === 'Late')    return 2;
  return 3;
}

function getWeekDatesFromStr(weekStr: string): string[] {
  const [year, weekNum] = weekStr.split('-').map(Number);
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const mondayOfWeek1 = new Date(jan1);
  mondayOfWeek1.setUTCDate(jan1.getUTCDate() + (jan1Day === 0 ? 1 : jan1Day === 1 ? 0 : 8 - jan1Day));
  const monday = new Date(mondayOfWeek1);
  monday.setUTCDate(mondayOfWeek1.getUTCDate() + (weekNum - 1) * 7);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

const WEEK_OFF_LABEL: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const week      = searchParams.get('week');
    const date      = searchParams.get('date');
    const teamId    = searchParams.get('teamId') || searchParams.get('team'); // legacy support
    const zoneId    = searchParams.get('zoneId') || searchParams.get('zone');
    const managerId = searchParams.get('manager');
    const statusFilter = searchParams.get('status');
    const dateFrom  = searchParams.get('dateFrom');
    const dateTo    = searchParams.get('dateTo');

    await connectDB();

    const isManager = ['admin', 'manager', 'hr'].includes(user.role);
      const todayStr  = getTodayIST();
      const logDate   = date || todayStr;

      // Get week off day + shift rules from DB
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zone = await OfficeZone.findOne({}).lean() as any;
      const baseRules = await getShiftRules();
      const weekOffDay   = zone?.weekOffDay || 'Tuesday';
      const weekOffLabel = WEEK_OFF_LABEL[weekOffDay] || 'Tue';

      const shiftInfo = {
        earlyBefore:  baseRules.shiftStart,
        onTimeTill:   `${baseRules.shiftStart} + ${baseRules.graceMinutes}m`,
        lateAfter:    `${baseRules.shiftStart} + ${baseRules.graceMinutes}m`,
        shiftStart: baseRules.shiftStart,
        shiftEnd: baseRules.shiftEnd,
        graceMinutes: baseRules.graceMinutes,
        weekOffDay,
        weekOffLabel,
      };

      // Determine date range
      let dates: string[] = [];
      if (dateFrom && dateTo) {
        const start = new Date(dateFrom);
        const end = new Date(dateTo);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
          const d = new Date(start);
          while (d <= end) {
            dates.push(d.toISOString().split('T')[0]);
            d.setDate(d.getDate() + 1);
          }
        }
      } else if (date)      dates = [date];
      else if (week) dates = getWeekDatesFromStr(week);

      if (isManager) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userQuery: any = {};
        if (user.role !== 'manager') {
          if (zoneId) userQuery.officeZoneId = zoneId;
          if (teamId) userQuery.teamId = teamId;
          if (managerId) userQuery.managerId = managerId;
        }

        const users = await User.find(userQuery, 'fullName email role playbookRole officeZoneId teamId teamName isApproved workSchedule')
          .select('-profilePhoto')
          .populate('officeZoneId', 'name')
          .populate('teamId', 'name')
          .lean() as any[];

      const employeeIds = users.map(u => u._id.toString());

      // Heatmap attendance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attQuery: any = { employeeId: { $in: employeeIds } };
      if (dates.length > 0) attQuery.date = { $in: dates };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allAtt = await Attendance.find(attQuery).lean() as any[];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heatmap = users.map((u: any) => {
        const empAtt = allAtt.filter(a => a.employeeId.toString() === u._id.toString());
        const days: Record<string, string> = {};
        for (const a of empAtt) days[a.date] = a.dayStatus;
        return {
          employeeId:   u._id.toString(),
          employeeName: u.fullName,
          role:         u.role,
          playbookRole: u.playbookRole || 'recruiter',
          team:         (u.officeZoneId as Record<string, unknown>)?.name || 'No Zone',
          isApproved:   u.isApproved,
          days,
        };
      });

      // Selected date log
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logAtt = await Attendance.find({
        employeeId: { $in: employeeIds },
        date: logDate,
      }).lean() as any[];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let todayLog = users
        .map((u: any) => {
          const att       = logAtt.find(a => a.employeeId.toString() === u._id.toString());
          const firstSess = att?.sessions?.[0];
          const rules = applyUserSchedule(baseRules, u.workSchedule);
          const derived = att ? deriveStatusFromAttendance(att, rules) : { dayStatus: 'Absent', lateByMins: 0, earlyByMins: 0 };
          return {
            employeeId:    u._id.toString(),
            employeeName:  u.fullName,
            role:          u.role,
            playbookRole:  u.playbookRole || 'recruiter',
            team:          (u.officeZoneId as Record<string, unknown>)?.name || 'No Zone',
            checkInTime:   firstSess?.checkIn ? fmtTime(new Date(firstSess.checkIn)) : null,
            isCheckedIn:   att?.isCheckedIn || false,
            workMode:      att?.workMode || (att?.isOnBreak ? 'Break' : att?.isInField ? 'Field' : att?.isCheckedIn ? 'Present' : 'Absent'),
            dayStatus:     derived.dayStatus || 'Absent',
            totalWorkMins: att?.totalWorkMins || 0,
            totalBreakMins: att?.totalBreakMins || 0,
            lateByMins:    derived.lateByMins || 0,
            earlyByMins:   derived.earlyByMins || 0,
          };
        })
        .sort((a, b) => statusSortOrder(a.dayStatus) - statusSortOrder(b.dayStatus));

      if (statusFilter && statusFilter !== 'all') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        todayLog = todayLog.filter((e: any) => e.dayStatus === statusFilter || e.workMode === statusFilter);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const present = todayLog.filter((e: any) => e.dayStatus !== 'Absent').length;

      const yesterday = new Date(logDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yDate = yesterday.toISOString().split('T')[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yAtt = await Attendance.find({ employeeId: { $in: employeeIds }, date: yDate }).lean() as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yPresent = yAtt.filter((a: any) => (a.dayStatus || 'Absent') !== 'Absent').length;

      // 7-day trend and team comparison
      const trendDates: string[] = [];
      const cursor = new Date(logDate);
      cursor.setDate(cursor.getDate() - 6);
      for (let i = 0; i < 7; i++) {
        trendDates.push(new Date(cursor).toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() + 1);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const trendAtt = await Attendance.find({ employeeId: { $in: employeeIds }, date: { $in: trendDates } }).lean() as any[];
      const lateTrend = trendDates.map(d => ({
        date: d,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        late: trendAtt.filter((a: any) => a.date === d && a.dayStatus === 'Late').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        present: trendAtt.filter((a: any) => a.date === d && a.dayStatus !== 'Absent').length,
      }));
      const teamComparison = Object.values(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        users.reduce((acc: any, u: any) => {
          const team = String((u.officeZoneId as Record<string, unknown>)?.name || 'No Zone');
          if (!acc[team]) acc[team] = { team, total: 0, present: 0, late: 0 };
          acc[team].total += 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = logAtt.find((x: any) => x.employeeId.toString() === u._id.toString());
          const status = a?.dayStatus || 'Absent';
          if (status !== 'Absent') acc[team].present += 1;
          if (status === 'Late') acc[team].late += 1;
          return acc;
        }, {})
      );

      return NextResponse.json({
        heatmap,
        todayLog,
        total: users.length,
        present,
        shiftInfo,
        yesterdayPresent: yPresent,
        presentDelta: present - yPresent,
        lateTrend,
        teamComparison,
      });

    } else {
      // Employee - own data only
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attQuery: any = { employeeId: user.id };
      if (dates.length > 0) attQuery.date = { $in: dates };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const empAtt = await Attendance.find(attQuery).lean() as any[];
      const days: Record<string, string> = {};
      for (const a of empAtt) days[a.date] = a.dayStatus;

      return NextResponse.json({
        heatmap: [{ employeeId: user.id, employeeName: user.fullName, days }],
        todayLog: [],
        total:    1,
        present:  days[todayStr] && days[todayStr] !== 'Absent' ? 1 : 0,
        shiftInfo,
      });
    }
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
