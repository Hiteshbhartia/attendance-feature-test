import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import Tracker from '@/models/Tracker';
import User from '@/models/User';
import { buildEmployeeFilter } from '@/lib/role-guards';
import { getWeekRange } from '@/lib/week-utils';
import mongoose from 'mongoose';

function parseNumber(value: string | null, fallback: number) {
  const parsed = parseInt(value || '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function dateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function getWeekKey(year: number, weekNumber: number) {
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
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
    const role = searchParams.get('role') || '';
    const team = searchParams.get('team') || '';

    const weekInfo = getWeekRange(year, week);
    const firstWeek = Math.max(1, week - 3);
    const historyWeeks = [] as Array<{ year: number; weekNumber: number; startDate: string; endDate: string }>;
    for (let w = firstWeek; w <= week; w += 1) {
      historyWeeks.push(getWeekRange(year, w));
    }

    const baseFilter: any = { isApproved: { $ne: false } };
    if (role) baseFilter.role = role;

    if (team) baseFilter.teamName = team;

    const empFilter = buildEmployeeFilter(auth, baseFilter);
    if (empFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();
    const users = await User.find(empFilter).select('_id fullName role teamName').lean() as any[];
    const userIds = users.map((u) => u._id);
    const totalUsers = userIds.length;

    const currentTrackers = await Tracker.find({
      date: { $gte: weekInfo.startDate, $lte: weekInfo.endDate },
      employeeId: { $in: userIds },
    }).lean();

    const historyStart = historyWeeks[0].startDate;
    const historyEnd = historyWeeks[historyWeeks.length - 1].endDate;
    const historyTrackers = await Tracker.find({
      date: { $gte: historyStart, $lte: historyEnd },
      employeeId: { $in: userIds },
    }).lean();

    const last30Start = dateDaysAgo(29);
    const last30Trackers = await Tracker.find({
      date: { $gte: last30Start, $lte: weekInfo.endDate },
      employeeId: { $in: userIds },
    }).lean();

    const metrics = {
      drafts30: currentTrackers.reduce((sum, t) => sum + (Number(t.drafts30) || 0), 0),
      mytAdded: currentTrackers.reduce((sum, t) => sum + (Number(t.mytAdded) || 0), 0),
      toursPipeline: currentTrackers.reduce((sum, t) => sum + (Number(t.toursPipeline) || 0), 0),
      toursDone: currentTrackers.reduce((sum, t) => sum + (Number(t.toursDone) || 0), 0),
      callsDone: currentTrackers.reduce((sum, t) => sum + (Number(t.callsDone) || 0), 0),
      connected: currentTrackers.reduce((sum, t) => sum + (Number(t.connected) || 0), 0),
    };

    const expectedWeek = totalUsers * 7;
    const weekSubmitted = currentTrackers.filter((t) => t.isSubmitted).length;
    const complianceWeek = expectedWeek > 0 ? Math.round((weekSubmitted / expectedWeek) * 100) : 0;

    const weekKeys = historyWeeks.map((w) => getWeekKey(w.year, w.weekNumber));
    const historyByWeek = new Map<string, number>();
    historyWeeks.forEach((w) => historyByWeek.set(getWeekKey(w.year, w.weekNumber), 0));
    historyTrackers.forEach((tracker) => {
      const trackerDate = tracker.date;
      const weekMatch = historyWeeks.find((w) => trackerDate >= w.startDate && trackerDate <= w.endDate);
      if (weekMatch && tracker.isSubmitted) {
        const key = getWeekKey(weekMatch.year, weekMatch.weekNumber);
        historyByWeek.set(key, (historyByWeek.get(key) || 0) + 1);
      }
    });

    const trend = historyWeeks.map((w) => {
      const key = getWeekKey(w.year, w.weekNumber);
      const submittedCount = historyByWeek.get(key) || 0;
      return {
        year: w.year,
        weekNumber: w.weekNumber,
        compliance: totalUsers > 0 ? Math.round((submittedCount / (totalUsers * 7)) * 100) : 0,
      };
    });

    const last30ByEmployee = new Map<string, number>();
    last30Trackers.forEach((tracker) => {
      if (tracker.isSubmitted) {
        const id = String(tracker.employeeId);
        last30ByEmployee.set(id, (last30ByEmployee.get(id) || 0) + 1);
      }
    });

    const topSubmitters = users
      .map((user) => ({
        employeeId: String(user._id),
        name: user.fullName,
        submitted: last30ByEmployee.get(String(user._id)) || 0,
      }))
      .sort((a, b) => b.submitted - a.submitted)
      .slice(0, 10);

    const repeatMissing = users
      .map((user) => {
        const submitted = last30ByEmployee.get(String(user._id)) || 0;
        return {
          employeeId: String(user._id),
          name: user.fullName,
          missed: Math.max(0, 30 - submitted),
        };
      })
      .sort((a, b) => b.missed - a.missed)
      .slice(0, 10);

    const goodWeekRate = users.map((user) => {
      const id = String(user._id);
      const userHistory = historyTrackers.filter((tracker) => String(tracker.employeeId) === id);
      const weekMap = new Map<string, { submitted: boolean; reviewed: boolean }>();
      userHistory.forEach((tracker) => {
        const trackerWeek = historyWeeks.find((w) => tracker.date >= w.startDate && tracker.date <= w.endDate);
        if (!trackerWeek) return;
        const weekKey = getWeekKey(trackerWeek.year, trackerWeek.weekNumber);
        const current = weekMap.get(weekKey) || { submitted: false, reviewed: false };
        if (tracker.isSubmitted) current.submitted = true;
        if (tracker.status === 'reviewed') current.reviewed = true;
        weekMap.set(weekKey, current);
      });
      const submittedWeeks = Array.from(weekMap.values()).filter((w) => w.submitted).length;
      const goodWeeks = Array.from(weekMap.values()).filter((w) => w.reviewed).length;
      return {
        employeeId: id,
        name: user.fullName,
        rate: submittedWeeks > 0 ? Math.round((goodWeeks / submittedWeeks) * 100) : 0,
        goodWeeks,
        submittedWeeks,
      };
    }).sort((a, b) => b.rate - a.rate).slice(0, 10);

    const pendingReviews = currentTrackers.filter((tracker) => tracker.isSubmitted && tracker.status !== 'reviewed').length;
    const complianceLast4 = trend.length > 0 ? Math.round(trend.reduce((sum, item) => sum + item.compliance, 0) / trend.length) : 0;

    return NextResponse.json({
      ok: true,
      summary: {
        complianceWeek,
        complianceLast4,
        pendingReviews,
      },
      metrics,
      trend,
      topSubmitters,
      repeatMissing,
      goodWeekRate,
    });
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
