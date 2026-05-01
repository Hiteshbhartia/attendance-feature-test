import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import WeeklyTracker from '@/models/WeeklyTracker';

// Helper: get ISO week number (1-52)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper: get week start (Monday) and end (Sunday) dates
function getWeekDates(year: number, week: number) {
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
  const weekStart = new Date(startOfWeek1);
  weekStart.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0],
  };
}

/**
 * GET /api/tracker
 * Employee: get own tracker entries
 * Admin: get all employees tracker for a given week/year
 * Query params: year, week, employeeId (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const week = searchParams.get('week') ? parseInt(searchParams.get('week')!) : null;
    const employeeId = searchParams.get('employeeId');

    const filter: Record<string, unknown> = { year };

    if (user.role === 'admin' || user.role === 'sub_admin') {
      // Admin can query any employee or all employees
      if (employeeId) filter.employeeId = employeeId;
      if (week) filter.weekNumber = week;
    } else {
      // Employee sees only their own
      filter.employeeId = user.id;
      if (week) filter.weekNumber = week;
    }

    const records = await WeeklyTracker.find(filter)
      .sort({ weekNumber: -1 })
      .populate('employeeId', 'fullName email')
      .lean();

    return NextResponse.json({ success: true, data: records });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to fetch tracker data' }, { status: 500 });
  }
}

/**
 * POST /api/tracker
 * Employee saves/updates their weekly tracker (upsert)
 * Body: { weekNumber, year, g1, g2, g3, g4, glTours, selfRating, selfNotes, status }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const body = await req.json();

    const { weekNumber, year, g1, g2, g3, g4, glTours, selfRating, selfNotes, status } = body;

    if (!weekNumber || !year) {
      return NextResponse.json({ success: false, error: 'weekNumber and year are required' }, { status: 400 });
    }
    if (weekNumber < 1 || weekNumber > 44) {
      return NextResponse.json({ success: false, error: 'weekNumber must be between 1 and 44' }, { status: 400 });
    }

    const { start, end } = getWeekDates(year, weekNumber);

    const updateData: Record<string, unknown> = {
      weekStartDate: start,
      weekEndDate: end,
    };
    if (g1 !== undefined) updateData.g1 = g1;
    if (g2 !== undefined) updateData.g2 = g2;
    if (g3 !== undefined) updateData.g3 = g3;
    if (g4 !== undefined) updateData.g4 = g4;
    if (glTours !== undefined) updateData.glTours = glTours;
    if (selfRating !== undefined) updateData.selfRating = selfRating;
    if (selfNotes !== undefined) updateData.selfNotes = selfNotes;
    if (status === 'submitted') {
      updateData.status = 'submitted';
      updateData.submittedAt = new Date();
    } else if (status === 'draft') {
      updateData.status = 'draft';
    }

    const record = await WeeklyTracker.findOneAndUpdate(
      { employeeId: user.id, year, weekNumber },
      {
        $set: updateData,
        $setOnInsert: { employeeId: user.id, year, weekNumber },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return NextResponse.json({ success: true, data: record });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save tracker';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/tracker
 * Admin reviews a tracker entry: set isGoodWeek, adminNotes, impact, issues, status=reviewed
 * Body: { trackerId, isGoodWeek, adminNotes, impact, issues }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'sub_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();
    const { trackerId, isGoodWeek, adminNotes, impact, issues } = body;

    if (!trackerId) {
      return NextResponse.json({ success: false, error: 'trackerId is required' }, { status: 400 });
    }

    const updated = await WeeklyTracker.findByIdAndUpdate(
      trackerId,
      {
        $set: {
          isGoodWeek: isGoodWeek ?? false,
          adminNotes: adminNotes || '',
          impact: impact || '',
          issues: issues || '',
          status: 'reviewed',
          reviewedAt: new Date(),
          reviewedBy: user.id,
        },
      },
      { new: true }
    );

    if (!updated) return NextResponse.json({ success: false, error: 'Tracker not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to review tracker' }, { status: 500 });
  }
}
