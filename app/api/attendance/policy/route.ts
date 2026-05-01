import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { ZodError, z } from 'zod';
import AttendancePolicy from '@/models/AttendancePolicy';

const policySchema = z.object({
  // Late arrival rules
  lateGraceMinutes: z.number().int().min(0).max(60).default(10),
  halfDayThresholdMinutes: z.number().int().min(60).max(300).default(120),
  absentThresholdMinutes: z.number().int().min(120).max(480).default(240),
  lateMarkAfterMinutes: z.number().int().min(0).max(120).default(15),

  // Overtime rules
  overtimeEnabled: z.boolean().default(true),
  overtimeThresholdMinutes: z.number().int().min(0).max(120).default(30),
  overtimeMultiplier: z.number().min(1).max(5).default(1.5),
  maxOvertimeHoursPerDay: z.number().min(0).max(12).default(4),
  maxOvertimeHoursPerMonth: z.number().min(0).max(100).default(50),

  // Working hours
  standardWorkingHoursPerDay: z.number().min(4).max(12).default(8),
  weeklyOffDays: z.array(z.enum(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])).default(['Sun']),

  // Late deduction
  lateDeductionEnabled: z.boolean().default(false),
  lateDeductionPerIncident: z.number().min(0).max(500).default(0),

  // Auto mark absent
  autoMarkAbsent: z.boolean().default(true),
  autoMarkAbsentAfterMidnight: z.boolean().default(true),
});

/**
 * GET /api/attendance/policy
 * Returns current org attendance policy (overtime, late, working hours)
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    // In a single-org setup, we just find the first policy available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let policy: any = await AttendancePolicy.findOne().lean();

    if (!policy) {
      // Return defaults if no policy set
      policy = {
        lateGraceMinutes: 10,
        halfDayThresholdMinutes: 120,
        absentThresholdMinutes: 240,
        lateMarkAfterMinutes: 15,
        overtimeEnabled: true,
        overtimeThresholdMinutes: 30,
        overtimeMultiplier: 1.5,
        maxOvertimeHoursPerDay: 4,
        maxOvertimeHoursPerMonth: 50,
        standardWorkingHoursPerDay: 8,
        weeklyOffDays: ['Sun'],
        lateDeductionEnabled: false,
        lateDeductionPerIncident: 0,
        autoMarkAbsent: true,
        autoMarkAbsentAfterMidnight: true,
      };
    }

    return NextResponse.json({ ok: true, policy });
  } catch (e) {
    console.error('[attendance/policy GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/attendance/policy
 * Update org attendance policy (admin only)
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    let parsed;
    try { parsed = policySchema.parse(body); }
    catch (e) {
      if (e instanceof ZodError) return NextResponse.json({ error: 'Invalid input', details: e.errors }, { status: 400 });
      throw e;
    }

    await connectDB();

    const policy = await AttendancePolicy.findOneAndUpdate(
      {}, // Single org policy
      { $set: { ...parsed, updatedBy: user.id, updatedAt: new Date() }, $setOnInsert: { orgId: user.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ ok: true, policy });
  } catch (e) {
    console.error('[attendance/policy PUT]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
