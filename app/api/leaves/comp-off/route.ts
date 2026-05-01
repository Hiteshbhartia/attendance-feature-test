import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import LeaveBalance from '@/models/LeaveBalance';
import Holiday from '@/models/Holiday';

/**
 * POST /api/leaves/comp-off
 * Body: { employeeId, date, reason? }
 * 
 * Credits 1 comp-off leave day to an employee who worked on a holiday or Sunday.
 * Admin/sub_admin can manually credit. System can also call this endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const body = await req.json();
    const { employeeId, date, reason, orgId } = body;

    if (!employeeId || !date) {
      return NextResponse.json({ success: false, error: 'employeeId and date are required' }, { status: 400 });
    }

    const workDate = new Date(date);
    const dayOfWeek = workDate.getDay(); // 0 = Sunday
    const year = workDate.getFullYear();

    // Check if the date is a Sunday or an org holiday
    const isSunday = dayOfWeek === 0;
    let isHoliday = false;
    if (orgId) {
      const dateStr = workDate.toISOString().split('T')[0];
      const holiday = await Holiday.findOne({ orgId, date: dateStr, isActive: true });
      isHoliday = !!holiday;
    }

    if (!isSunday && !isHoliday) {
      return NextResponse.json({
        success: false,
        error: 'Comp-off can only be credited for work done on a Sunday or a declared holiday',
      }, { status: 400 });
    }

    // Find or create the leave balance for this employee for this year
    let balance = await LeaveBalance.findOne({ employeeId, year });
    if (!balance) {
      balance = await LeaveBalance.create({ employeeId, year });
    }

    // Credit 1 comp-off day
    balance.comp_off.total += 1;
    await balance.save();

    return NextResponse.json({
      success: true,
      message: `Comp-off credited for ${date}${
        isSunday ? ' (Sunday)' : ' (Holiday)'
      }${reason ? `: ${reason}` : ''}`,
      data: {
        employeeId,
        date,
        comp_off_total: balance.comp_off.total,
        comp_off_used: balance.comp_off.used,
        comp_off_available: balance.comp_off.total - balance.comp_off.used - balance.comp_off.pending,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to credit comp-off';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * GET /api/leaves/comp-off?employeeId=xxx&year=2026
 * Returns comp-off balance for an employee
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();

    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'employeeId is required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balance: any = await LeaveBalance.findOne({ employeeId, year }).lean();
    if (!balance) {
      return NextResponse.json({ success: true, data: { comp_off: { total: 0, used: 0, pending: 0 } } });
    }

    return NextResponse.json({
      success: true,
      data: {
        comp_off: balance.comp_off,
        available: balance.comp_off.total - balance.comp_off.used - balance.comp_off.pending,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch comp-off balance' }, { status: 500 });
  }
}
