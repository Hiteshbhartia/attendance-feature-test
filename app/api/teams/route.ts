/**
 * GET  /api/teams        - List all active teams with member counts
 * POST /api/teams        - Create a new team (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Team from '@/models/Team';
import User from '@/models/User';
import { requirePermission, requireAnyPermission } from '@/lib/permission-middleware';
import { isAdmin } from '@/lib/permissions';
import { slugify } from '@/lib/slugify';

export async function GET() {
  try {
    const { user, error } = await requireAnyPermission(['VIEW_TEAM_EMPLOYEES', 'VIEW_ALL_EMPLOYEES']);
    if (error) return error;

    await connectDB();

    const filter: Record<string, unknown> = { isActive: true };
    if (!isAdmin(user)) {
      filter.managerId = user.id;
    }

    const teams = await Team.find(filter)
      .select('name slug description color isActive createdAt')
      .sort({ name: 1 })
      .lean() as any[];

    // Attach member counts in one aggregation
    const teamNames = teams.map(t => t.name);
    const counts = await User.aggregate([
      { $match: { teamName: { $in: teamNames }, isApproved: true } },
      { $group: { _id: '$teamName', count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    counts.forEach((c: any) => { countMap[c._id] = c.count; });

    const result = teams.map(t => ({ ...t, memberCount: countMap[t.name] ?? 0 }));
    return NextResponse.json({ ok: true, teams: result });
  } catch (e: unknown) {
    console.error('[teams GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission('MANAGE_TEAM');
    if (error) return error;

    const body = await req.json();
    const { name, description, color } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    const trimmedName = String(name).trim();
    const slug = slugify(trimmedName);

    await connectDB();

    // Case-insensitive duplicate check
    const existing = await Team.findOne({
      name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      isActive: true,
    });
    if (existing) {
      return NextResponse.json({ error: `Team "${trimmedName}" already exists` }, { status: 409 });
    }

    // Ensure slug uniqueness by appending a counter if needed
    let finalSlug = slug;
    let counter = 1;
    while (await Team.findOne({ slug: finalSlug })) {
      finalSlug = `${slug}_${counter++}`;
    }

    const team = await Team.create({
      name: trimmedName,
      slug: finalSlug,
      description: description || '',
      managerId: user.id === 'admin' ? new (await import('mongoose')).default.Types.ObjectId() : user.id,
      color: color || '#6366f1',
    });

    return NextResponse.json({ ok: true, team }, { status: 201 });
  } catch (e: unknown) {
    console.error('[teams POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
