import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import Task from '@/models/Task';
import ExceptionRequest from '@/models/ExceptionRequest';
import Tracker from '@/models/Tracker';
import '@/models/OfficeZone';
import { getAuthUser } from '@/lib/auth';
import { getISTDateStr } from '@/lib/attendance-utils';
import { buildScopedEmployeeFilter, isAdmin } from '@/lib/permissions';
import mongoose from 'mongoose';

function fmtTime(d: Date) {
  return new Date(d).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
}

function getISTDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getISTDateStr(d);
}

// Safe settled result unwrapper
function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  if (result.status === 'fulfilled') return result.value;
  console.error('[command-center] Sub-query failed:', result.reason);
  return fallback;
}

export async function GET() {
  try {
    const user = await getAuthUser();

    // FAIL-SAFE: admin always passes. Also allow hr, manager, team_lead via role or systemRole.
    const ALLOWED_ROLES = ['admin', 'manager', 'hr', 'team_lead', 'sub_admin'];
    const userRole = user?.systemRole || user?.role || '';
    const legacyRole = user?.role || '';

    if (!user || (!ALLOWED_ROLES.includes(userRole) && !ALLOWED_ROLES.includes(legacyRole) && !isAdmin(user))) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[command-center] Unauthorized user role: role=${user?.role}, systemRole=${user?.systemRole}`);
      }
      return NextResponse.json({ 
        ok: false, 
        error: 'Unauthorized: Insufficient role to access command center',
        fallbackData: null,
      }, { status: 403 });
    }

    await connectDB();
    const today = getISTDateStr();
    const yDate = getISTDateDaysAgo(1);

    // FAIL-SAFE hierarchy scope: admins/HR get all, managers get subtree
    let empFilter: Record<string, unknown> = { isApproved: { $ne: false }, role: 'employee' };
    try {
      const scoped = await buildScopedEmployeeFilter(user, { isApproved: { $ne: false }, role: 'employee' });
      if (scoped) {
        empFilter = scoped;
      }
      // If null (would mean employee), admins still get all
      if (!scoped && isAdmin(user)) {
        empFilter = { isApproved: { $ne: false }, role: 'employee' };
      }
    } catch (filterErr) {
      console.error('[command-center] Scope filter failed, falling back to all employees:', filterErr);
      if (!isAdmin(user)) {
        empFilter = { managerId: user.id, isApproved: { $ne: false }, role: 'employee' };
      }
    }

    const employees = await User.find(empFilter, 'fullName email officeZoneId')
      .select('-profilePhoto')
      .lean() as any[];

    const total = employees.length;
    const employeeIds = employees.map(e => e._id);

    // RESILIENT: Use Promise.allSettled so one failure doesn't crash everything
    const [todayAttRes, yAttRes, taskStatsRes, pendingApprovalsRes, trackerStatsRes, officeZonesRes] = 
      await Promise.allSettled([
        Attendance.find({ employeeId: { $in: employeeIds }, date: today }).lean(),
        Attendance.find({ employeeId: { $in: employeeIds }, date: yDate }).lean(),
        (async () => {
          const isManagerRole = ['manager', 'team_lead'].includes(legacyRole) || ['manager', 'team_lead'].includes(userRole);
          const taskFilter = isManagerRole ? { assignedTo: { $in: employeeIds } } : {};
          const [taskTotal, blocked, completed, overdue] = await Promise.all([
            Task.countDocuments(taskFilter),
            Task.countDocuments({ ...taskFilter, status: 'blocked' }),
            Task.countDocuments({ ...taskFilter, status: 'completed' }),
            Task.countDocuments({ ...taskFilter, status: { $nin: ['completed', 'cancelled'] }, dueDate: { $lt: today } }),
          ]);
          return { total: taskTotal, blocked, completed, overdue };
        })(),
        (async () => {
          const isManagerRole = ['manager', 'team_lead'].includes(legacyRole) || ['manager', 'team_lead'].includes(userRole);
          if (isManagerRole) {
            return ExceptionRequest.countDocuments({ status: 'pending', employeeId: { $in: employeeIds } });
          }
          return ExceptionRequest.countDocuments({ status: 'pending' });
        })(),
        (async () => {
          const isManagerRole = ['manager', 'team_lead'].includes(legacyRole) || ['manager', 'team_lead'].includes(userRole);
          const trackerFilter: any = isManagerRole ? { employeeId: { $in: employeeIds } } : {};
          
          const trackerTotal = isManagerRole
            ? total
            : await User.countDocuments({ role: { $in: ['admin', 'manager', 'employee'] }, isApproved: { $ne: false } });

          const weekStart = getISTDateDaysAgo(6);
          const monthStart = `${today.slice(0, 7)}-01`;

          const [submittedToday, editedToday, submittedWeek, submittedMonth] = await Promise.all([
            Tracker.countDocuments({ ...trackerFilter, date: today, isSubmitted: true }),
            Tracker.countDocuments({ ...trackerFilter, date: today, isEdited: true }),
            Tracker.countDocuments({ ...trackerFilter, date: { $gte: weekStart, $lte: today }, isSubmitted: true }),
            Tracker.countDocuments({ ...trackerFilter, date: { $gte: monthStart, $lte: today }, isSubmitted: true }),
          ]);

          return { trackerTotal, submittedToday, editedToday, submittedWeek, submittedMonth };
        })(),
        (async () => {
          const empZoneIds = [...new Set(employees.filter(e => e.officeZoneId).map(e => e.officeZoneId.toString()))];
          return (await mongoose.model('GpOfficeZone').find({ _id: { $in: empZoneIds } }, 'name').lean()) as unknown as any[];
        })(),
      ]);

    // Unpack with safe defaults
    const todayAtt = settled(todayAttRes, []);
    const yAtt = settled(yAttRes, []);
    const taskStats = settled(taskStatsRes, { total: 0, blocked: 0, completed: 0, overdue: 0 });
    const pendingApprovals = settled(pendingApprovalsRes, 0);
    const trackerStats = settled(trackerStatsRes, { trackerTotal: 0, submittedToday: 0, editedToday: 0, submittedWeek: 0, submittedMonth: 0 });
    const officeZones = settled(officeZonesRes, []);

    const attMap = new Map((todayAtt as any[]).map((a: any) => [a.employeeId.toString(), a]));
    const yesterdayPresent = (yAtt as any[]).filter((a: any) => (a.dayStatus || 'Absent') !== 'Absent').length;
    const zoneMap = new Map((officeZones as any[]).map((z: any) => [z._id.toString(), z.name]));

    let presentCount = 0, absentCount = 0, lateCount = 0, earlyCount = 0, onTimeCount = 0, breakCount = 0, fieldCount = 0;

    const teamPulse = employees.map(emp => {
      const att = attMap.get(emp._id.toString()) as any;
      let workMode = 'Absent', dayStatus = 'Absent', checkInTime = null;
      if (att) {
        workMode  = att.workMode || (att.isOnBreak ? 'Break' : att.isInField ? 'Field' : att.isCheckedIn ? 'Present' : 'Absent');
        dayStatus = att.dayStatus || 'Absent';
        const firstWork = att.sessions?.find((s: any) => s.type === 'work' || !s.type);
        if (firstWork) checkInTime = fmtTime(new Date(firstWork.checkIn));
      }
      if (workMode === 'Present') presentCount++;
      else if (workMode === 'Break')  { presentCount++; breakCount++; }
      else if (workMode === 'Field')  { presentCount++; fieldCount++; }
      else absentCount++;
      if (dayStatus === 'Late')    lateCount++;
      if (dayStatus === 'Early')   earlyCount++;
      if (dayStatus === 'On Time') onTimeCount++;
      return {
        employeeId:   emp._id.toString(),
        employeeName: emp.fullName ?? 'Unknown',
        team: zoneMap.get(emp.officeZoneId?.toString()) || 'No Zone',
        workMode, dayStatus, checkInTime,
      };
    }).sort((a, b) => {
      const o: Record<string, number> = { Present: 0, Break: 1, Field: 2, WFH: 3, Absent: 4 };
      return (o[a.workMode] ?? 4) - (o[b.workMode] ?? 4);
    });

    const taskSummary = taskStats;
    const attendanceRate     = total > 0 ? Math.round((presentCount / total) * 100) : 0;
    const onTimeRate         = presentCount > 0 ? Math.round((onTimeCount / Math.max(presentCount, 1)) * 100) : 0;
    const taskCompletionRate = taskSummary.total > 0 ? Math.round((taskSummary.completed / taskSummary.total) * 100) : 0;
    const breakDiscipline    = Math.max(0, 100 - (breakCount * 5));

    const needAction: any[] = [];
    if (taskSummary.blocked > 0)    needAction.push({ type: 'blocked_tasks', count: taskSummary.blocked, label: `${taskSummary.blocked} blocked task${taskSummary.blocked > 1 ? 's' : ''}` });
    if (lateCount > 0)               needAction.push({ type: 'late', count: lateCount, label: `${lateCount} employee${lateCount > 1 ? 's' : ''} late today` });
    if (taskSummary.overdue > 0)    needAction.push({ type: 'overdue', count: taskSummary.overdue, label: `${taskSummary.overdue} overdue task${taskSummary.overdue > 1 ? 's' : ''}` });
    if (presentCount < yesterdayPresent) {
      needAction.push({ type: 'attendance_drop', count: yesterdayPresent - presentCount, label: `Attendance drop vs yesterday: -${yesterdayPresent - presentCount}` });
    }

    const { trackerTotal, submittedToday, editedToday, submittedWeek, submittedMonth } = trackerStats;
    const trackerExpectedWeek  = trackerTotal * 7;
    const trackerExpectedMonth = trackerTotal * (new Date(today).getDate());
    const trackerCompliance = {
      daily:   trackerTotal > 0 ? Math.round((submittedToday / trackerTotal) * 100) : 0,
      weekly:  trackerExpectedWeek  > 0 ? Math.round((submittedWeek  / trackerExpectedWeek)  * 100) : 0,
      monthly: trackerExpectedMonth > 0 ? Math.round((submittedMonth / trackerExpectedMonth) * 100) : 0,
      submittedToday,
      missingToday: Math.max(0, trackerTotal - submittedToday),
      editedToday,
    };

    const healthScore = Math.round(
      (attendanceRate * 0.45) +
      (onTimeRate * 0.25) +
      (taskCompletionRate * 0.2) +
      (trackerCompliance.daily * 0.1)
    );

    return NextResponse.json({
      ok: true, date: today,
      summary: { total, present: presentCount, absent: absentCount, late: lateCount, early: earlyCount, onTime: onTimeCount, onBreak: breakCount, inField: fieldCount, activeNow: presentCount },
      compare: { yesterdayPresent, presentDelta: presentCount - yesterdayPresent },
      healthScore,
      kpis: { attendance: attendanceRate, onTimeRate, taskCompletion: taskCompletionRate, breakDiscipline },
      trackerCompliance,
      teamPulse, taskSummary, pendingApprovals, needAction,
    });
  } catch (e: unknown) {
    console.error('[command-center] Fatal API error:', e);
    return NextResponse.json({ 
      ok: false,
      error: 'Internal server error',
      fallbackData: {
        summary: { total: 0, present: 0, absent: 0, late: 0, early: 0, onTime: 0, onBreak: 0, inField: 0, activeNow: 0 },
        healthScore: 0,
        kpis: { attendance: 0, onTimeRate: 0, taskCompletion: 0, breakDiscipline: 0 },
        teamPulse: [],
        taskSummary: { blocked: 0, overdue: 0, total: 0, completed: 0 },
        pendingApprovals: 0,
        needAction: [],
      }
    }, { status: 500 });
  }
}
