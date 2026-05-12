/**
 * POST /api/hierarchy/assign
 *
 * Assigns hierarchy role, reporting manager, team, department, and job title to an employee.
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import HierarchyRole from '@/models/HierarchyRole';
import { requirePermission } from '@/lib/permission-middleware';
import mongoose from 'mongoose';
import { NotificationService } from '@/modules/notifications/notification.service';

export async function POST(req: NextRequest) {
  try {
    const { error } = await requirePermission('ASSIGN_MANAGER');
    if (error) return error;

    const body = await req.json();
    const { employeeId, hierarchyRoleId, managerId, teamId, teamName, officeZoneId, jobTitle } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return NextResponse.json({ error: 'Invalid employeeId' }, { status: 400 });
    }

    await connectDB();

    const updates: Record<string, unknown> = {};

    // ── Physical Location (Zone) ──
    if (officeZoneId !== undefined) {
      if (officeZoneId && !mongoose.Types.ObjectId.isValid(officeZoneId)) {
        return NextResponse.json({ error: 'Invalid officeZoneId' }, { status: 400 });
      }
      updates.officeZoneId = officeZoneId || null;
    }

    // 1. Hierarchy role (authority tier)
    if (hierarchyRoleId !== undefined) {
      if (!hierarchyRoleId) {
        updates.hierarchyRoleId = null;
        updates.systemRole = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(hierarchyRoleId)) {
          return NextResponse.json({ error: 'Invalid hierarchyRoleId' }, { status: 400 });
        }
        const hRole = await HierarchyRole.findById(hierarchyRoleId).lean() as any;
        if (!hRole) {
          return NextResponse.json({ error: 'Hierarchy role not found' }, { status: 404 });
        }
        updates.hierarchyRoleId = hierarchyRoleId;
        updates.systemRole = hRole.systemRole;

        // Keep legacy `role` field in sync
        const legacyRoleMap: Record<string, string> = {
          admin:     'admin',
          manager:   'manager',
          team_lead: 'manager',
          hr:        'employee',
          employee:  'employee',
        };
        const legacyRole = legacyRoleMap[hRole.systemRole];
        if (legacyRole) updates.role = legacyRole;
      }
    }

    // 2. Reporting manager
    if (managerId !== undefined) {
      if (!managerId) {
        updates.managerId = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(managerId)) {
          return NextResponse.json({ error: 'Invalid managerId' }, { status: 400 });
        }
        if (managerId === employeeId) {
          return NextResponse.json({ error: 'An employee cannot report to themselves' }, { status: 400 });
        }
        updates.managerId = managerId;
      }
    }

    // 3. Operational team (Object ID and/or Name)
    if (teamId !== undefined) {
      updates.teamId = teamId || null;
    }
    if (teamName !== undefined) {
      updates.teamName = teamName || '';
    }

    // 4. Job title (display only)
    if (jobTitle !== undefined) {
      updates.jobTitle = typeof jobTitle === 'string' ? jobTitle.trim() : '';
    }

    const oldUser = await User.findById(employeeId).select('hierarchyRoleId managerId teamName').lean() as any;
    if (!oldUser) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const updated = await User.findByIdAndUpdate(
      employeeId,
      { $set: updates },
      { new: true, select: '-password' }
    ).populate('hierarchyRoleId', 'name').populate('managerId', 'fullName').lean() as any;

    // 5. Send Notifications for changes
    if (updated) {
      // Role changed
      if (updates.hierarchyRoleId && String(updates.hierarchyRoleId) !== String(oldUser.hierarchyRoleId)) {
        await NotificationService.createNotification({
          userId: employeeId,
          type: 'SYSTEM',
          title: 'Hierarchy Role Updated 🛡️',
          message: `Your organizational role has been updated to ${updated.hierarchyRoleId?.name || 'Standard Employee'}.`,
          link: '/home',
        });
      }

      // Manager changed
      if (updates.managerId && String(updates.managerId) !== String(oldUser.managerId)) {
        await NotificationService.createNotification({
          userId: employeeId,
          type: 'SYSTEM',
          title: 'Reporting Manager Assigned 🤝',
          message: `You now report to ${updated.managerId?.fullName || 'a new manager'}.`,
          link: '/team-hierarchy',
        });
      }

      // Team changed (KPI Inheritance)
      if (updates.teamName !== undefined && updates.teamName !== oldUser.teamName) {
        await NotificationService.createNotification({
          userId: employeeId,
          type: 'KPI_ASSIGNED',
          title: 'Team KPIs Inherited 🎯',
          message: `You have joined the "${updates.teamName || 'Unassigned'}" team and inherited its KPIs and sprint plans.`,
          link: '/arena',
        });
      }
    }

    return NextResponse.json({ ok: true, user: updated });
  } catch (e: unknown) {
    console.error('[hierarchy/assign POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
