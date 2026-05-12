/**
 * PATCH  /api/teams/[id]  - Rename / update a team (admin only)
 * DELETE /api/teams/[id]  - Archive a team (admin only, blocked if members exist)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Team from '@/models/Team';
import User from '@/models/User';
import { requirePermission } from '@/lib/permission-middleware';
import mongoose from 'mongoose';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission('MANAGE_TEAM');
    if (error) return error;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
    }

    const body = await req.json();
    const allowed = ['name', 'description', 'color'];
    const updates: Record<string, unknown> = {};

    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (updates.name) {
      const trimmed = String(updates.name).trim();
      if (!trimmed) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });

      await connectDB();
      // Duplicate check (exclude self)
      const dup = await Team.findOne({
        _id: { $ne: id },
        name: { $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        isActive: true,
      });
      if (dup) return NextResponse.json({ error: `Team "${trimmed}" already exists` }, { status: 409 });
      updates.name = trimmed;
    } else {
      await connectDB();
    }

    const team = await Team.findByIdAndUpdate(id, { $set: updates }, { new: true });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    return NextResponse.json({ ok: true, team });
  } catch (e: unknown) {
    console.error('[teams PATCH]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission('MANAGE_TEAM');
    if (error) return error;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
    }

    await connectDB();

    const team = await Team.findById(id).lean() as any;
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    // Block deletion if employees are still assigned to this team name
    const memberCount = await User.countDocuments({ teamName: team.name, isApproved: true });
    if (memberCount > 0) {
      return NextResponse.json(
        { error: `Cannot archive "${team.name}" — ${memberCount} employee${memberCount !== 1 ? 's are' : ' is'} still assigned to it` },
        { status: 409 }
      );
    }

    // Soft delete
    await Team.findByIdAndUpdate(id, { $set: { isActive: false } });
    return NextResponse.json({ ok: true, message: `"${team.name}" archived` });
  } catch (e: unknown) {
    console.error('[teams DELETE]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
