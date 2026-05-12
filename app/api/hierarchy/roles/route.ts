/**
 * GET  /api/hierarchy/roles  - List all hierarchy role definitions
 * POST /api/hierarchy/roles  - Create a new hierarchy role (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import HierarchyRole from '@/models/HierarchyRole';
import { requirePermission } from '@/lib/permission-middleware';
import { DEFAULT_HIERARCHY_CAPABILITIES } from '@/components/hierarchy/types';

export async function GET() {
  try {
    const { user, error } = await requirePermission('VIEW_ADMIN_PANEL');
    if (error) return error;

    await connectDB();
    const dbRoles = await HierarchyRole.find({ isActive: true }).sort({ level: 1, name: 1 }).lean();
    
    // Hydrate roles with default capabilities if missing, and handle legacy 'permissions' rename
    const roles = dbRoles.map((r: any) => {
      const caps = r.capabilities || r.permissions || DEFAULT_HIERARCHY_CAPABILITIES;
      return {
        ...r,
        capabilities: { ...DEFAULT_HIERARCHY_CAPABILITIES, ...caps }
      };
    });

    return NextResponse.json({ roles });
  } catch (e: unknown) {
    console.error('[hierarchy/roles GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requirePermission('MANAGE_ROLES');
    if (error) return error;

    const body = await req.json();
    const { name, slug, systemRole, level, color, capabilities } = body;

    if (!name || !slug || !systemRole) {
      return NextResponse.json({ error: 'name, slug, and systemRole are required' }, { status: 400 });
    }

    const validSystemRoles = ['admin', 'manager', 'team_lead', 'hr', 'employee'];
    if (!validSystemRoles.includes(systemRole)) {
      return NextResponse.json(
        { error: `systemRole must be one of: ${validSystemRoles.join(', ')}` },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await HierarchyRole.findOne({ slug });
    if (existing) {
      return NextResponse.json({ error: 'A role with this slug already exists' }, { status: 409 });
    }

    const role = await HierarchyRole.create({
      name,
      slug,
      systemRole,
      level: level ?? 4,
      color: color ?? '#6b7280',
      capabilities: capabilities || {
        canViewKPIs: true, canEditKPIs: false, canCreateKPIs: false,
        canViewAttendance: false, canEditAttendance: false,
        canConduct1on1s: false, canManageReports: false,
        canApproveRequests: false, canViewTeamDashboards: false
      },
    });

    return NextResponse.json({ ok: true, role }, { status: 201 });
  } catch (e: unknown) {
    console.error('[hierarchy/roles POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/hierarchy/roles/[id] - Handled in route.ts if using folder based routing, 
 * but since this is a single file, I'll check if I need a separate dynamic route.
 * Actually, Next.js App Router uses separate files for dynamic routes usually.
 */

