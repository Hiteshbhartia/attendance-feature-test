import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Task from '@/models/Task';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/lib/constants';
import { taskSchema } from '@/lib/validations';
import { ZodError } from 'zod';
import { getISTDateStr } from '@/lib/attendance-utils';
import { isAdmin, isElevated, isSubAdmin, canAccessEmployee } from '@/lib/role-guards';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSummary(tasks: any[]) {
  const summary: Record<string, number> = {
    total: tasks.length, todo: 0, in_progress: 0, blocked: 0, pending_review: 0,
    completed: 0, overdue: 0, cancelled: 0,
  };
  for (const t of tasks) summary[t.status] = (summary[t.status] || 0) + 1;
  return summary;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTask(task: any) {
  return {
    _id: task._id.toString(), title: task.title, description: task.description || '',
    assignedTo: task.assignedTo?.toString?.() || task.assignedTo,
    assignedToName: task.assignedToName || '', assignedBy: task.assignedBy || '',
    assignedByName: task.assignedByName || '', dueDate: task.dueDate || null,
    priority: task.priority || 'medium', status: task.status || 'todo',
    teamId: task.teamId || null, teamName: task.teamName || '',
    completionNote: task.completionNote || '', completionPhoto: task.completionPhoto || null,
    completedAt: task.completedAt || null, createdAt: task.createdAt, updatedAt: task.updatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function refreshOverdue(tasks: any[]) {
  const today = getISTDateStr();
  for (const t of tasks) {
    if (t.dueDate && t.dueDate < today && !['completed', 'cancelled', 'overdue'].includes(t.status)) {
      t.status = 'overdue';
      await t.save();
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};
    if (user.role === 'employee') {
      query.assignedTo = user.id;
    } else if (isSubAdmin(user) && user.assignedTeamId) {
      // sub_admin sees only tasks for their team
      query.teamId = user.assignedTeamId;
    }

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit = Math.min(parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_LIMIT)), MAX_PAGE_LIMIT);
    const skip  = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      Task.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Task.countDocuments(query),
    ]);
    await refreshOverdue(docs);
    const tasks = docs.map(normalizeTask);
    return NextResponse.json({ ok: true, tasks, summary: buildSummary(tasks), total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    // sub_admin can create tasks (for their team only)
    if (!user || !['admin', 'manager', 'sub_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin/Manager/SubAdmin only' }, { status: 403 });
    }

    const body = await req.json();
    let parsed;
    try {
      parsed = taskSchema.parse(body);
    } catch (e) {
      if (e instanceof ZodError) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
      throw e;
    }

    const { title, description, assignedTo, assignedToName, dueDate, priority, teamName, teamId } = parsed;
    if (!title || !assignedTo) return NextResponse.json({ error: 'title and assignedTo are required' }, { status: 400 });
    if (!mongoose.Types.ObjectId.isValid(assignedTo)) return NextResponse.json({ error: 'Invalid assignedTo' }, { status: 400 });

    await connectDB();
    // Fetch assignee with team info
    const assignee = await User.findById(assignedTo).populate('teamId', 'name').lean() as any;
    if (!assignee) return NextResponse.json({ error: 'Assignee not found' }, { status: 404 });

    const task = await Task.create({
      title: String(title).trim(), description: description || '',
      assignedTo, assignedToName: assignedToName || assignee.fullName || assignee.email,
      assignedBy: user.id, assignedByName: user.fullName || user.email || 'Manager',
      dueDate: dueDate || null, priority: priority || 'medium', status: 'todo',
      teamId:   teamId   || assignee.teamId?._id?.toString?.() || assignee.teamId?.toString() || null,
      teamName: teamName || assignee.teamName || assignee.teamId?.name || '',
    });
    return NextResponse.json({ ok: true, task: normalizeTask(task) });
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { taskId, status, completionNote, completionPhoto } = await req.json();
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

    const allowed = ['todo', 'in_progress', 'blocked', 'pending_review', 'completed', 'overdue', 'cancelled'];
    if (status && !allowed.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

    await connectDB();
    const task = await Task.findById(taskId);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // employee: can only update their own tasks (unchanged)
    if (user.role === 'employee' && task.assignedTo.toString() !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // sub_admin: can only update tasks in their team
    if (isSubAdmin(user) && user.role !== 'manager' && user.assignedTeamId) {
      if (task.teamId && task.teamId.toString() !== user.assignedTeamId) {
        return NextResponse.json({ error: 'Cannot update task outside your team' }, { status: 403 });
      }
    }

    if (status) task.status = status;
    if (completionNote  !== undefined) task.completionNote  = completionNote;
    if (completionPhoto !== undefined) task.completionPhoto = completionPhoto;
    if (status === 'completed' && !task.completedAt) task.completedAt = new Date();
    if (status && status !== 'completed') task.completedAt = null;
    await task.save();
    return NextResponse.json({ ok: true, task: normalizeTask(task) });
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
