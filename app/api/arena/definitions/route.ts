/**
 * GET  /api/arena/definitions  - Fetch KPIs and sprints for a team
 * POST /api/arena/definitions  - Create/update a KPI or sprint (admin only)
 * DELETE /api/arena/definitions - Delete a KPI or sprint (admin only)
 *
 * ARCHITECTURE:
 *   KPIs and sprint plans are owned by TEAMS (teamName).
 *   When an employee belongs to "HR Team", they inherit all HR Team KPIs.
 *   Hierarchy roles (Manager, Employee) do NOT drive KPI assignment.
 */

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { ArenaKPIDefinition, ArenaSprintPlan } from '@/models/ArenaState';
import User from '@/models/User';
import { NotificationService } from '@/modules/notifications/notification.service';
import { slugify } from '@/lib/slugify';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const teamName = searchParams.get('teamName');

    await connectDB();

    const query: any = {};
    if (teamName) query.teamName = teamName;

    const [kpis, sprints] = await Promise.all([
      ArenaKPIDefinition.find(query).sort({ teamName: 1, orderIndex: 1 }),
      ArenaSprintPlan.find(query).sort({ teamName: 1, orderIndex: 1 }),
    ]);

    return NextResponse.json({ ok: true, kpis, sprints });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, data } = body; // type: 'kpi' | 'sprint'

    if (!data.teamName) {
      return NextResponse.json({ error: 'teamName is required' }, { status: 400 });
    }

    await connectDB();

    if (type === 'kpi') {
      if (data.type === 'NUMBER' && typeof data.target !== 'number') {
        return NextResponse.json({ error: 'Target must be a number for NUMBER type' }, { status: 400 });
      }
      if (data.type === 'BOOLEAN' && typeof data.target !== 'boolean') {
        return NextResponse.json({ error: 'Target must be true/false for BOOLEAN type' }, { status: 400 });
      }

      const isNew = !data._id;

      // Auto-generate kpiName from label if not provided
      if (isNew && !data.kpiName) {
        let baseKey = slugify(data.label);
        let finalKey = baseKey;
        let counter = 1;
        while (await ArenaKPIDefinition.findOne({ teamName: data.teamName, kpiName: finalKey })) {
          finalKey = `${baseKey}_${counter++}`;
        }
        data.kpiName = finalKey;
      }

      const kpi = await ArenaKPIDefinition.findOneAndUpdate(
        { _id: data._id || new mongoose.Types.ObjectId() },
        { $set: data },
        { new: true, upsert: true }
      );

      if (isNew) {
        // Notify all employees in this team
        const users = await User.find({ teamName: data.teamName, isApproved: true }).select('_id');
        for (const u of users) {
          await NotificationService.createNotification({
            userId: String(u._id),
            type: 'KPI_ASSIGNED',
            title: 'New KPI Assigned 🎯',
            message: `A new KPI "${data.label}" has been added to your team.`,
            link: '/arena',
            metadata: { kpiId: kpi._id, teamName: data.teamName },
          });
        }
      }

      return NextResponse.json({ ok: true, kpi });

    } else if (type === 'sprint') {
      const isNew = !data._id;
      const sprint = await ArenaSprintPlan.findOneAndUpdate(
        { _id: data._id || new mongoose.Types.ObjectId() },
        { $set: data },
        { new: true, upsert: true }
      );

      if (isNew) {
        const users = await User.find({ teamName: data.teamName, isApproved: true }).select('_id');
        for (const u of users) {
          await NotificationService.createNotification({
            userId: String(u._id),
            type: 'SPRINT_ASSIGNED',
            title: 'Sprint Plan Updated ⚡',
            message: `A new sprint "${data.sprintName}" has been added to your team schedule.`,
            link: '/arena',
            metadata: { sprintId: sprint._id, teamName: data.teamName },
          });
        }
      }

      return NextResponse.json({ ok: true, sprint });
    }

    return NextResponse.json({ error: 'Invalid type — must be kpi or sprint' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id   = searchParams.get('id');
    const type = searchParams.get('type');

    await connectDB();

    if (type === 'kpi')    await ArenaKPIDefinition.findByIdAndDelete(id);
    else if (type === 'sprint') await ArenaSprintPlan.findByIdAndDelete(id);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
