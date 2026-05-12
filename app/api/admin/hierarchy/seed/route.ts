import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import HierarchyRole from '@/models/HierarchyRole';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';

export async function POST() {
  try {
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // 1. Define Default Roles
    const defaultRoles = [
      {
        name: 'Admin',
        slug: 'admin',
        systemRole: 'admin',
        level: 0,
        color: '#ef4444', // Red
        description: 'Full system access and organization management.',
        capabilities: {
          canViewKPIs: true,
          canEditKPIs: true,
          canCreateKPIs: true,
          canViewAttendance: true,
          canEditAttendance: true,
          canConduct1on1s: true,
          canManageReports: true,
          canApproveRequests: true,
          canViewTeamDashboards: true,
        }
      },
      {
        name: 'Manager',
        slug: 'manager',
        systemRole: 'manager',
        level: 1,
        color: '#8b5cf6', // Purple
        description: 'Manages teams, KPIs, and performance reviews.',
        capabilities: {
          canViewKPIs: true,
          canEditKPIs: true,
          canCreateKPIs: false,
          canViewAttendance: true,
          canEditAttendance: false,
          canConduct1on1s: true,
          canManageReports: true,
          canApproveRequests: true,
          canViewTeamDashboards: true,
        }
      },
      {
        name: 'Team Lead',
        slug: 'team_lead',
        systemRole: 'team_lead',
        level: 2,
        color: '#3b82f6', // Blue
        description: 'Leads operational groups and reviews daily reports.',
        capabilities: {
          canViewKPIs: true,
          canEditKPIs: false,
          canCreateKPIs: false,
          canViewAttendance: true,
          canEditAttendance: false,
          canConduct1on1s: true,
          canManageReports: true,
          canApproveRequests: true,
          canViewTeamDashboards: true,
        }
      },
      {
        name: 'Senior Employee',
        slug: 'senior_employee',
        systemRole: 'employee',
        level: 3,
        color: '#10b981', // Green
        description: 'Experienced staff with elevated dashboard visibility.',
        capabilities: {
          canViewKPIs: true,
          canEditKPIs: false,
          canCreateKPIs: false,
          canViewAttendance: false,
          canEditAttendance: false,
          canConduct1on1s: false,
          canManageReports: false,
          canApproveRequests: false,
          canViewTeamDashboards: true,
        }
      },
      {
        name: 'Employee',
        slug: 'employee',
        systemRole: 'employee',
        level: 4,
        color: '#6b7280', // Gray
        description: 'Standard staff access to personal dashboard.',
        capabilities: {
          canViewKPIs: true,
          canEditKPIs: false,
          canCreateKPIs: false,
          canViewAttendance: false,
          canEditAttendance: false,
          canConduct1on1s: false,
          canManageReports: false,
          canApproveRequests: false,
          canViewTeamDashboards: false,
        }
      }
    ];

    // 2. Upsert Roles
    const createdRoles: Record<string, any> = {};
    for (const roleData of defaultRoles) {
      const role = await HierarchyRole.findOneAndUpdate(
        { slug: roleData.slug },
        { $set: roleData },
        { upsert: true, new: true }
      );
      createdRoles[roleData.slug] = role._id;
    }

    // 3. Migrate Users (Safe Refactor)
    // - Managers (role === 'manager') -> Manager Hierarchy Role
    // - Admins (role === 'admin') -> Admin Hierarchy Role
    // - Employees (role === 'employee' AND no hierarchyRoleId) -> Employee Hierarchy Role

    const managerUpdate = await User.updateMany(
      { role: 'manager', hierarchyRoleId: null },
      { $set: { hierarchyRoleId: createdRoles['manager'], systemRole: 'manager' } }
    );

    const adminUpdate = await User.updateMany(
      { role: 'admin', hierarchyRoleId: null },
      { $set: { hierarchyRoleId: createdRoles['admin'], systemRole: 'admin' } }
    );

    const employeeUpdate = await User.updateMany(
      { role: 'employee', hierarchyRoleId: null },
      { $set: { hierarchyRoleId: createdRoles['employee'], systemRole: 'employee' } }
    );

    return NextResponse.json({
      ok: true,
      roles: Object.keys(createdRoles),
      migration: {
        managers: managerUpdate.modifiedCount,
        admins: adminUpdate.modifiedCount,
        employees: employeeUpdate.modifiedCount,
      }
    });
  } catch (e: any) {
    console.error('[Hierarchy Seed Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
