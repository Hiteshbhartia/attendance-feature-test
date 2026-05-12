import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import Tracker from '@/models/Tracker';
import User from '@/models/User';
import { buildEmployeeFilter } from '@/lib/role-guards';
import { getCurrentWeekInfo, getWeekRange } from '@/lib/week-utils';
import mongoose from 'mongoose';

function parseNumber(value: string | null, fallback: number) {
  const parsed = parseInt(value || '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function aggregateTrackers(trackers: any[]) {
  const summary = {
    drafts30: 0,
    mytAdded: 0,
    toursPipeline: 0,
    toursDone: 0,
    callsDone: 0,
    connected: 0,
    manualLeadsToday: 0,
    manualToursToday: 0,
    doubts: false,
    status: 'missing' as 'missing' | 'draft' | 'submitted' | 'reviewed',
  };

  if (!trackers.length) {
    return summary;
  }

  const hasSubmitted = trackers.some((t) => !!t.isSubmitted);
  const hasReviewed = trackers.some((t) => t.status === 'reviewed');
  const hasDraft = trackers.some((t) => !t.isSubmitted && t.status === 'draft');
  summary.drafts30 = trackers.reduce((sum, t) => sum + (Number(t.drafts30) || 0), 0);
  summary.mytAdded = trackers.reduce((sum, t) => sum + (Number(t.mytAdded) || 0), 0);
  summary.toursPipeline = trackers.reduce((sum, t) => sum + (Number(t.toursPipeline) || 0), 0);
  summary.toursDone = trackers.reduce((sum, t) => sum + (Number(t.toursDone) || 0), 0);
  summary.callsDone = trackers.reduce((sum, t) => sum + (Number(t.callsDone) || 0), 0);
  summary.connected = trackers.reduce((sum, t) => sum + (Number(t.connected) || 0), 0);
  summary.manualLeadsToday = trackers.reduce((sum, t) => sum + (Number(t.manualLeadsToday) || 0), 0);
  summary.manualToursToday = trackers.reduce((sum, t) => sum + (Number(t.manualToursToday) || 0), 0);
  summary.doubts = trackers.some((t) => normalizeText(t.doubts).length > 0);
  summary.status = hasReviewed ? 'reviewed' : hasSubmitted ? 'submitted' : hasDraft ? 'draft' : 'missing';
  return summary;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseNumber(searchParams.get('year'), new Date().getFullYear());
    const week = parseNumber(searchParams.get('week'), 1);
    const employeeId = normalizeText(searchParams.get('employeeId'));
    const role = normalizeText(searchParams.get('role'));

    const teamName = normalizeText(searchParams.get('team'));
    const status = normalizeText(searchParams.get('status'));

    const weekInfo = getWeekRange(year, week);
    const baseFilter: any = { isApproved: { $ne: false } };
    if (role) baseFilter.role = role;

    if (teamName) baseFilter.teamName = teamName;
    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
      baseFilter._id = new mongoose.Types.ObjectId(employeeId);
    }

    const empFilter = buildEmployeeFilter(auth, baseFilter);
    if (empFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();
    const employees = await User.find(empFilter)
      .select('fullName email role teamName jobRole')
      .lean() as any[];
    const totalEmployees = employees.length;
    const employeeIds = employees.map((e) => e._id);

    const trackers = await Tracker.find({
      date: { $gte: weekInfo.startDate, $lte: weekInfo.endDate },
      employeeId: { $in: employeeIds },
    }).lean();

    const trackerMap = new Map<string, any[]>();
    trackers.forEach((tracker) => {
      const id = String(tracker.employeeId);
      const existing = trackerMap.get(id) || [];
      existing.push(tracker);
      trackerMap.set(id, existing);
    });

    const employeeYearTrackers = (employeeId && mongoose.Types.ObjectId.isValid(employeeId))
      ? await Tracker.find({
          date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
          employeeId: new mongoose.Types.ObjectId(employeeId),
        }).lean()
      : [];

    let rows = employees.map((employee) => {
      const empId = String(employee._id);
      const weeklyTrackers = trackerMap.get(empId) || [];
      const aggregated = aggregateTrackers(weeklyTrackers);
      return {
        employeeId: empId,
        employeeName: employee.fullName,
        email: employee.email,
        role: employee.role,
        teamName: employee.teamName || '',

        jobRole: employee.jobRole || '',
        weekNumber: week,
        weekStartDate: weekInfo.startDate,
        weekEndDate: weekInfo.endDate,
        status: aggregated.status,
        tracker: {
          drafts30: aggregated.drafts30,
          mytAdded: aggregated.mytAdded,
          toursPipeline: aggregated.toursPipeline,
          toursDone: aggregated.toursDone,
          callsDone: aggregated.callsDone,
          connected: aggregated.connected,
          manualLeadsToday: aggregated.manualLeadsToday,
          manualToursToday: aggregated.manualToursToday,
          doubts: aggregated.doubts ? 'Yes' : 'No',
          isGoodWeek: weeklyTrackers.some((t) => t.isGoodWeek),
          adminNotes: weeklyTrackers.find((t) => normalizeText(t.adminNotes).length > 0)?.adminNotes || '',
          adminImpact: weeklyTrackers.find((t) => normalizeText(t.adminImpact).length > 0)?.adminImpact || '',
          adminIssues: weeklyTrackers.find((t) => normalizeText(t.adminIssues).length > 0)?.adminIssues || '',
        },
      };
    });

    if (status) {
      rows = rows.filter((row) => row.status === status);
    }

    const submittedWeek = rows.filter((row) => row.status === 'submitted' || row.status === 'reviewed').length;
    const missingWeek = rows.filter((row) => row.status === 'missing').length;
    const goodWeeks = rows.filter((row) => row.status === 'reviewed').length;

    const records = employeeId && mongoose.Types.ObjectId.isValid(employeeId) && employees.length === 1
      ? (() => {
          const yearStart = `${year}-01-01`;
          const yearEnd = `${year}-12-31`;
          const employeeTrackers = employeeYearTrackers;
          const currentYearInfo = getCurrentWeekInfo();
          const maxWeek = year === currentYearInfo.year ? currentYearInfo.weekNumber : 44;
          const weekRanges = Array.from({ length: maxWeek }, (_, index) => getWeekRange(year, index + 1));
          const weeklyMap = new Map<number, any[]>();
          weekRanges.forEach((weekRange) => weeklyMap.set(weekRange.weekNumber, []));
          employeeTrackers.forEach((tracker) => {
            const weekRange = weekRanges.find((weekRange) => tracker.date >= weekRange.startDate && tracker.date <= weekRange.endDate);
            if (weekRange) {
              weeklyMap.get(weekRange.weekNumber)?.push(tracker);
            }
          });
          const employee = employees[0] || {};
          return weekRanges.map((weekRange) => {
            const weeklyTrackers = weeklyMap.get(weekRange.weekNumber) || [];
            const aggregated = aggregateTrackers(weeklyTrackers);
            return {
              _id: `${employeeId}-${year}-${weekRange.weekNumber}`,
              employeeId,
              employeeName: employee.fullName || '',
              role: employee.role || '',
              teamName: employee.teamName || '',

              weekNumber: weekRange.weekNumber,
              weekStartDate: weekRange.startDate,
              weekEndDate: weekRange.endDate,
              status: aggregated.status,
              isGoodWeek: weeklyTrackers.some((t) => t.isGoodWeek),
              adminNotes: weeklyTrackers.find((t) => normalizeText(t.adminNotes).length > 0)?.adminNotes || '',
              adminImpact: weeklyTrackers.find((t) => normalizeText(t.adminImpact).length > 0)?.adminImpact || '',
              adminIssues: weeklyTrackers.find((t) => normalizeText(t.adminIssues).length > 0)?.adminIssues || '',
              drafts30: aggregated.drafts30,
              mytAdded: aggregated.mytAdded,
              toursPipeline: aggregated.toursPipeline,
              toursDone: aggregated.toursDone,
              callsDone: aggregated.callsDone,
              connected: aggregated.connected,
              manualLeadsToday: aggregated.manualLeadsToday,
              manualToursToday: aggregated.manualToursToday,
              doubts: aggregated.doubts ? 'Yes' : 'No',
            };
          });
        })()
      : [];

    return NextResponse.json({
      ok: true,
      summary: {
        totalEmployees,
        submittedWeek,
        missingWeek,
        goodWeeks,
      },
      rows,
      records,
    });
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
