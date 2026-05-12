import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import OfficeZone from '@/models/OfficeZone';
import '@/models/HierarchyRole'; // register for populate
import { getAuthUser } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import mongoose from 'mongoose';
import { orgUpdateSchema } from '@/lib/validations';
import { ZodError } from 'zod';
import { DEFAULT_HIERARCHY_CAPABILITIES } from '@/components/hierarchy/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEmployee(e: any) {
  return {
    _id:             e._id.toString(),
    fullName:        e.fullName,
    email:           e.email,
    role:            e.role,
    systemRole:      e.systemRole ?? e.role,
    hierarchyRole:   e.hierarchyRoleId
      ? { _id: e.hierarchyRoleId._id?.toString(), name: e.hierarchyRoleId.name, color: e.hierarchyRoleId.color, level: e.hierarchyRoleId.level }
      : null,
    teamName:        e.teamName   || '',
    team:            e.teamName   || 'No Team', // Keep 'team' for backward compat in some UI components
    officeZoneId:    e.officeZoneId?._id?.toString() || e.officeZoneId?.toString() || null,
    officeZoneName:  (e.officeZoneId as any)?.name || 'No Zone',
    jobRole:         e.jobRole    || '',
    isApproved:      e.isApproved,
    managerId:       e.managerId?.toString?.() || null,
    managerName:     (e.managerId as any)?.fullName || null,
  };
}

// GET /api/org
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !canAccess(user, 'VIEW_TEAM_EMPLOYEES')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Scoped query: managers see only their direct reports; admins see all
    const baseQuery: Record<string, unknown> = {};
    if (user.role === 'manager') {
      baseQuery.managerId = user.id;
    }

    // Fetch all users — use only exclusion projections to avoid mixed-projection errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let users: any[] = [];
    try {
      users = await User.find(baseQuery)
        .select('-password -profilePhoto')
        .populate('officeZoneId', 'name')
        .populate('managerId', 'fullName email role')
        .populate({ path: 'hierarchyRoleId', select: 'name color level slug systemRole capabilities permissions', strictPopulate: false })
        .lean() as any[];

      // Hydrate capabilities for all users (supports legacy 'permissions' field migration)
      users = users.map(u => {
        if (u.hierarchyRoleId) {
          const legacyCaps = u.hierarchyRoleId.permissions || {};
          const newCaps = u.hierarchyRoleId.capabilities || {};
          u.hierarchyRoleId.capabilities = {
            ...DEFAULT_HIERARCHY_CAPABILITIES,
            ...legacyCaps,
            ...newCaps,
          };
        }
        return u;
      });
    } catch (populateErr) {
      // Fallback: if hierarchyRoleId populate fails (model not yet seeded), fetch without it
      console.warn('[org GET] hierarchyRoleId populate failed, retrying without it:', populateErr);
      users = await User.find(baseQuery)
        .select('-password -profilePhoto')
        .populate('officeZoneId', 'name')
        .populate('managerId', 'fullName email role')
        .lean() as any[];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zones = await OfficeZone.find({}).lean() as any[];

    // Managers are those with canManageReports permission OR legacy manager/admin roles
    const dbManagers = users.filter(u => 
      u.hierarchyRoleId?.permissions?.canManageReports || 
      u.role === 'admin' || 
      u.role === 'manager'
    );
    // All non-admin users are potential employees in the hierarchy
    const employees  = users.filter(u => u.role !== 'admin');

    // Check if any employees have managerId assigned
    const hasManagerAssignments = employees.some(e => {
      const mgrId = (e.managerId as any)?._id?.toString?.() || e.managerId?.toString?.() || null;
      return !!mgrId;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tree: any[] = [];

    if (hasManagerAssignments && dbManagers.length > 0) {
      // Group by manager — true hierarchy view
      tree = dbManagers.map(mgr => ({
        _id:       mgr._id.toString(),
        fullName:  mgr.fullName,
        email:     mgr.email,
        role:      mgr.role,
        systemRole: mgr.systemRole ?? mgr.role,
        hierarchyRole: mgr.hierarchyRoleId
          ? { _id: mgr.hierarchyRoleId._id?.toString(), name: mgr.hierarchyRoleId.name, color: mgr.hierarchyRoleId.color, level: mgr.hierarchyRoleId.level }
          : null,
        teamName:  mgr.teamName || '',
        team:      mgr.teamName || 'No Team',
        officeZoneId:   mgr.officeZoneId?._id?.toString() || mgr.officeZoneId?.toString() || null,
        officeZoneName: (mgr.officeZoneId as any)?.name || 'No Zone',
        groupType: 'manager',
        reports:   employees
          .filter(e => {
            const mgrId = (e.managerId as any)?._id?.toString?.() || e.managerId?.toString?.() || null;
            return mgrId === mgr._id.toString();
          })
          .map(e => mapEmployee(e)),
      }));
    } else {
      // Fallback: group by office zone when no manager assignments exist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tree = zones.map((z: any) => ({
        _id:       z._id.toString(),
        fullName:  z.name,
        email:     '',
        role:      'zone',
        systemRole: 'zone',
        hierarchyRole: null,
        team:      z.name,
        groupType: 'zone',
        reports:   employees
          .filter(e => e.officeZoneId?._id?.toString() === z._id.toString())
          .map(e => mapEmployee(e)),
      })).filter(z => z.reports.length > 0);
    }

    // Unassigned employees — always computed regardless of grouping mode
    const unassigned = employees.filter(e => {
      const mgrId = (e.managerId as any)?._id?.toString?.() || e.managerId?.toString?.() || null;
      return !mgrId;
    }).map(e => mapEmployee(e));

    // Available managers for dropdown — capability-driven with fallback
    const availableManagers = users
      .filter(u => 
        u.hierarchyRoleId?.permissions?.canManageReports || 
        u.role === 'admin' || 
        u.role === 'manager'
      )
      .map(m => ({
        _id:           m._id.toString(),
        fullName:      m.fullName,
        email:         m.email,
        role:          m.role,
        systemRole:    m.systemRole ?? m.role,
        hierarchyRole: m.hierarchyRoleId
          ? { name: m.hierarchyRoleId.name, color: m.hierarchyRoleId.color }
          : null,
      }));

    console.log(`[org GET] total=${users.length} managers=${dbManagers.length} employees=${employees.length} unassigned=${unassigned.length} tree=${tree.length}`);

    return NextResponse.json({
      ok: true,
      tree,
      unassigned,
      total: users.length,
      groupedByZone: !hasManagerAssignments,
      availableManagers,
    });
  } catch (e: unknown) {
    console.error('[org GET] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/org - assign manager/team/department
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 401 });
    }

    const body = await req.json();
    let parsed;
    try {
      parsed = orgUpdateSchema.parse(body);
    } catch (e) {
      if (e instanceof ZodError) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
      }
      throw e;
    }

    const { employeeId, managerId, teamName } = parsed;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return NextResponse.json({ error: 'Invalid employeeId' }, { status: 400 });
    }

    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: any = {};
    if (managerId  !== undefined) update.managerId  = managerId || null;
    if (teamName   !== undefined) update.teamName   = teamName;

    const updated = await User.findByIdAndUpdate(
      employeeId, update, { new: true }
    ).select('-password');

    if (!updated) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    return NextResponse.json({ ok: true, employee: updated });
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


