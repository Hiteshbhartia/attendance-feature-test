import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import HierarchyRole from '@/models/HierarchyRole';
import { requirePermission } from '@/lib/permission-middleware';
import mongoose from 'mongoose';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission('MANAGE_ROLES');
    if (error) return error;

    const { id } = await params;
    console.log('[Hierarchy PATCH] ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: `Invalid ID: ${id}` }, { status: 400 });
    }

    const body = await req.json();
    const { name, slug, systemRole, level, color, capabilities, isActive } = body;

    await connectDB();

    const update: any = {};
    if (name !== undefined) update.name = name;
    if (slug !== undefined) update.slug = slug;
    if (systemRole !== undefined) update.systemRole = systemRole;
    if (level !== undefined) update.level = level;
    if (color !== undefined) update.color = color;
    if (capabilities !== undefined) update.capabilities = capabilities;
    if (isActive !== undefined) update.isActive = isActive;

    const updated = await HierarchyRole.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, role: updated });
  } catch (e: unknown) {
    console.error('[hierarchy/roles PATCH]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission('MANAGE_ROLES');
    if (error) return error;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: `Invalid ID: ${id}` }, { status: 400 });
    }

    await connectDB();

    // Soft delete
    const deleted = await HierarchyRole.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!deleted) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: 'Role archived' });
  } catch (e: unknown) {
    console.error('[hierarchy/roles DELETE]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
