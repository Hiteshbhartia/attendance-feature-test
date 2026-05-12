import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import Tracker from '@/models/Tracker';
import User from '@/models/User';
import { getISTDateStr } from '@/lib/attendance-utils';
import { buildEmployeeFilter } from '@/lib/role-guards';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || getISTDateStr();
    const status = searchParams.get('status') || '';
    const role = searchParams.get('role') || '';
    const teamName = searchParams.get('team') || '';
    const employeeId = searchParams.get('employeeId') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));

    const baseFilter: any = { isApproved: { $ne: false } };
    if (role) baseFilter.role = role;

    if (teamName) baseFilter.teamName = teamName;
    if (employeeId) baseFilter._id = employeeId;

    const empFilter = buildEmployeeFilter(auth, baseFilter);
    if (empFilter === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    await connectDB();
    const totalEmployees = await User.countDocuments(empFilter);
    const employees = await User.find(empFilter)
      .select('fullName email role teamName jobRole managerId')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean() as any[];

    const employeeIds = employees.map(e => e._id);
    const trackers = await Tracker.find({ date, employeeId: { $in: employeeIds } }).lean();
    const trackerMap = new Map(trackers.map(t => [t.employeeId.toString(), t]));

    let rows = employees.map(e => {
      const t = trackerMap.get(e._id.toString());
      const rowStatus = t
        ? (t.isSubmitted ? (t.isEdited ? 'edited' : 'submitted') : 'pending')
        : 'missing';
      return {
        employeeId: e._id.toString(),
        employeeName: e.fullName,
        email: e.email,
        role: e.role,
        teamName: e.teamName || '',
        jobRole: e.jobRole || '',
        status: rowStatus,
        tracker: t || null,
      };
    });

    if (status) rows = rows.filter(r => r.status === status);

    const allIds = await User.find(empFilter).select('_id').lean();
    const allIdList = allIds.map(r => r._id);
    const submittedToday = await Tracker.countDocuments({ date, employeeId: { $in: allIdList }, isSubmitted: true });
    const editedToday = await Tracker.countDocuments({ date, employeeId: { $in: allIdList }, isEdited: true });
    const missingToday = Math.max(0, totalEmployees - submittedToday);

    return NextResponse.json({
      ok: true,
      date,
      page,
      limit,
      totalEmployees,
      totalPages: Math.max(1, Math.ceil(totalEmployees / limit)),
      summary: {
        totalEmployees,
        submittedToday,
        missingToday,
        editedToday,
      },
      rows,
    });
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
