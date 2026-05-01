import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import LeaveBalance from '@/models/LeaveBalance';

// GET /api/leaves/balance - Get leave balance for current user
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const userId = user.id;

    // Get employee record
    const employee = await User.findById(userId);

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get leave balance
    const leaveBalance = await LeaveBalance.findOne({
      employeeId: employee.id,
      year: new Date().getFullYear(),
    });

    if (!leaveBalance) {
      // Return default balance if not set
      return NextResponse.json({
        casual: { total: 0, used: 0, pending: 0 },
        sick: { total: 0, used: 0, pending: 0 },
        earned: { total: 0, used: 0, pending: 0 },
        comp_off: { total: 0, used: 0, pending: 0 },
      });
    }

    return NextResponse.json(leaveBalance);
  } catch (e) {
    console.error('[leaves/balance GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
