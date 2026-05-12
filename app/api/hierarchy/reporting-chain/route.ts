/**
 * GET /api/hierarchy/reporting-chain?employeeId=xxx
 *
 * Returns the full reporting chain (upward) for an employee.
 * e.g. Employee → Team Lead → Manager → Admin
 *
 * Useful for: reviews, approvals, 1:1 session routing.
 * Max depth: 10 levels to prevent infinite loops.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import '@/models/HierarchyRole'; // required so Mongoose registers the schema for populate
import { requireAuth } from '@/lib/permission-middleware';
import { isAdmin, canAccessEmployeeData } from '@/lib/permissions';
import mongoose from 'mongoose';

const MAX_DEPTH = 10;

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId') || user.id;

    // Employees can only view their own chain; elevated roles can view others
    if (employeeId !== user.id && !isAdmin(user)) {
      // Check if the requester is in the chain (manager of the employee)
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return NextResponse.json({ error: 'Invalid employeeId' }, { status: 400 });
      }
      const target = await User.findById(employeeId).select('managerId').lean() as any;
      if (!target) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

      const allowed = await canAccessEmployeeData(user, employeeId, target.managerId?.toString());
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return NextResponse.json({ error: 'Invalid employeeId' }, { status: 400 });
    }

    await connectDB();

    const chain: Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      systemRole?: string;
      depth: number;
    }> = [];

    let currentId: string | null = employeeId;
    let depth = 0;
    const visited = new Set<string>();

    while (currentId && depth < MAX_DEPTH) {
      if (visited.has(currentId)) break; // cycle guard
      visited.add(currentId);

      const person = await User.findById(currentId)
        .select('fullName email role systemRole managerId hierarchyRoleId')
        .populate('hierarchyRoleId', 'name slug color')
        .lean() as any;

      if (!person) break;

      chain.push({
        id: person._id.toString(),
        fullName: person.fullName,
        email: person.email,
        role: person.role,
        systemRole: person.systemRole ?? person.role,
        depth,
      });

      currentId = person.managerId?.toString() ?? null;
      depth++;
    }

    return NextResponse.json({ chain, employeeId });
  } catch (e: unknown) {
    console.error('[hierarchy/reporting-chain GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
