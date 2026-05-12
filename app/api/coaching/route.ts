import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import CoachingSession from '@/models/CoachingSession';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Task from '@/models/Task';
import Tracker from '@/models/Tracker';
import { getAuthUser } from '@/lib/auth';
import { isElevated } from '@/lib/role-guards';
import { NotificationService } from '@/modules/notifications/notification.service';

function normalizeSession(s: any, isEmployee = false) {
  const base = {
    _id: s._id?.toString(),
    employeeId: s.employeeId?.toString(),
    employeeName: s.employeeName,
    employeeRole: s.employeeRole || '',
    conductedBy: s.conductedBy,
    conductedByName: s.conductedByName,
    scheduledAt: s.scheduledAt,
    duration: s.duration,
    meetingType: s.meetingType,
    meetingLink: s.meetingLink || '',
    status: s.status,
    isRecurring: s.isRecurring,
    recurringFrequency: s.recurringFrequency || null,
    agendaItems: s.agendaItems || [],
    sharedNotes: s.sharedNotes || '',
    discussionPoints: s.discussionPoints || [],
    healthStatus: s.healthStatus,
    healthNote: s.healthNote || '',
    actionItems: (s.actionItems || []).map((a: any) => ({
      _id: a._id?.toString(),
      title: a.title,
      description: a.description || '',
      dueDate: a.dueDate || null,
      status: a.status,
      completedAt: a.completedAt || null,
      completedNote: a.completedNote || '',
    })),
    aiSummary: s.aiSummary || '',
    aiWins: s.aiWins || [],
    aiBlockers: s.aiBlockers || [],
    aiFollowUp: s.aiFollowUp || '',
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };

  if (!isEmployee) {
    return { ...base, privateNotes: s.privateNotes || '' };
  }
  return base;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(req.url);
    const tab      = searchParams.get('tab') || 'all';
    const search   = searchParams.get('search') || '';
    const page     = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit    = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip     = (page - 1) * limit;
    const isEmployee = user.role === 'employee';
    const { buildScopedEmployeeFilter, canAccessCoaching, isAdmin } = await import('@/lib/permissions');
    const isSysAdmin = isAdmin(user);

    const query: any = {};
    const now = new Date();

    if (isEmployee) {
      if (!mongoose.Types.ObjectId.isValid(user.id)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
      query.employeeId = new mongoose.Types.ObjectId(user.id);
    } else {
      // Scoped view for Managers/Team Leads
      if (!isSysAdmin && !canAccessCoaching(user)) {
        return NextResponse.json({ error: 'Unauthorized to view team coaching' }, { status: 403 });
      }

      try {
        const filter = await buildScopedEmployeeFilter(user);
        if (filter && filter._id) {
          query.employeeId = filter._id;
        }
      } catch (err) {
        console.error('[Coaching GET] Hierarchy scope failed:', err);
        if (isSysAdmin) {
          // Admin bypass: no restriction if filter fails
        } else {
          // Manager fallback: see only self (safety)
          query.employeeId = user.id;
        }
      }
    }

    if (tab === 'upcoming') {
      query.scheduledAt = { $gte: now };
      query.status = 'scheduled';
    } else if (tab === 'past') {
      query.$or = [{ scheduledAt: { $lt: now } }, { status: { $in: ['completed', 'cancelled', 'missed'] } }];
    } else if (tab === 'needs-attention') {
      query.healthStatus = { $in: ['needs-attention', 'immediate-support'] };
    }

    if (search) {
      const re = new RegExp(search, 'i');
      query.$and = query.$and || [];
      query.$and.push({ $or: [{ employeeName: re }, { conductedByName: re }] });
    }

    const [sessions, total] = await Promise.all([
      CoachingSession.find(query).sort({ scheduledAt: tab === 'past' ? -1 : 1 }).skip(skip).limit(limit).lean(),
      CoachingSession.countDocuments(query),
    ]);

    let metrics = null;
    if (!isEmployee) {
      const [upcoming, needsAttention, allSessions] = await Promise.all([
        CoachingSession.countDocuments({ scheduledAt: { $gte: now }, status: 'scheduled' }),
        CoachingSession.countDocuments({ healthStatus: { $in: ['needs-attention', 'immediate-support'] } }),
        CoachingSession.find({ status: 'completed' }, 'actionItems').lean(),
      ]);

      let totalActions = 0, completedActions = 0;
      for (const s of allSessions as any[]) {
        for (const a of (s.actionItems || [])) {
          totalActions++;
          if (a.status === 'completed') completedActions++;
        }
      }

      const taskRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;
      const recent = await CoachingSession.aggregate([
        { $match: { status: { $in: ['scheduled', 'completed'] } } },
        { $sort: { employeeId: 1, scheduledAt: -1 } },
        { $group: { _id: '$employeeId', latestHealth: { $first: '$healthStatus' } } },
      ]);

      let doingWell = 0, needsAttentionCount = 0, immediateSupport = 0;
      for (const r of recent) {
        if (r.latestHealth === 'doing-well') doingWell++;
        else if (r.latestHealth === 'needs-attention') needsAttentionCount++;
        else if (r.latestHealth === 'immediate-support') immediateSupport++;
      }
      metrics = { upcoming, needsAttention, taskCompletionRate: taskRate, doingWell, needsAttentionCount, immediateSupport };
    }

    return NextResponse.json({
      ok: true,
      sessions: sessions.map(s => normalizeSession(s, isEmployee)),
      metrics,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error('[coaching GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    const { canAccess, canAccessEmployeeData } = await import('@/lib/permissions');

    const isAuthorized = user && (
      user.role === 'admin' || 
      user.systemRole === 'admin' || 
      canAccess(user, 'MANAGE_TEAM_COACHING')
    );

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized to schedule coaching' }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();
    const { employeeId, scheduledAt, duration, meetingType, meetingLink, isRecurring, recurringFrequency } = body;

    if (!employeeId || !scheduledAt) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // Hierarchy check: can this manager schedule for THIS employee?
    const hasAccess = await canAccessEmployeeData(user, employeeId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized: Employee is not in your subtree' }, { status: 403 });
    }

    const eid = new mongoose.Types.ObjectId(employeeId);

    // --- INTELLIGENT PRE-POPULATION LOGIC ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fromStr = thirtyDaysAgo.toISOString().split('T')[0];

    const [employee, attendances, tasks, trackers] = await Promise.all([
      User.findById(employeeId).select('fullName playbookRole').lean(),
      Attendance.find({ employeeId: eid, date: { $gte: fromStr } }).select('dayStatus').lean(),
      Task.find({ assignedTo: eid }).select('status dueDate').lean(),
      Tracker.find({ employeeId: eid, date: { $gte: fromStr } }).select('id').lean(),
    ]);

    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Calculate signals for pre-filled agenda
    let lateCount = attendances.filter(a => a.dayStatus === 'Late').length;
    let overdueCount = tasks.filter(t => t.status === 'overdue' || (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed')).length;
    const activeDays = attendances.filter(a => a.dayStatus !== 'Absent').length;
    const eodConsistency = Math.round(((trackers.length) / Math.max(1, activeDays)) * 100);

    const agenda = [];
    const actionItems = [];
    let sharedNotes = `DISCUSSION AGENDA\n------------------\n`;

    if (lateCount > 2) {
      agenda.push('Attendance Discipline');
      sharedNotes += `• Address ${lateCount} late logins recorded in the last 30 days.\n`;
      actionItems.push({ title: 'Improve attendance punctuality (Target: 0 lates next week)', status: 'pending' });
    }
    if (overdueCount > 0) {
      agenda.push('Execution Review');
      sharedNotes += `• Review ${overdueCount} overdue tasks and identify blockers.\n`;
      actionItems.push({ title: `Resolve existing ${overdueCount} overdue items`, status: 'pending' });
    }
    if (eodConsistency < 85) {
      agenda.push('Reporting Consistency');
      sharedNotes += `• Improve daily reporting frequency (Current: ${eodConsistency}%).\n`;
      actionItems.push({ title: 'Submit 100% of Daily Update Trackers next week', status: 'pending' });
    }

    if (agenda.length === 0) {
      agenda.push('Performance Catch-up', 'Future Growth Plans');
      sharedNotes += `• Employee is performing well across all operational signals.\n• Discuss long-term career goals and potential stretch opportunities.`;
    }

    const sessionsToCreate = [];
    const dates = [new Date(scheduledAt)];
    if (isRecurring && recurringFrequency) {
      const freq = recurringFrequency === 'weekly' ? 7 : recurringFrequency === 'biweekly' ? 14 : 30;
      for (let i = 1; i < 4; i++) {
        const d = new Date(scheduledAt);
        d.setDate(d.getDate() + freq * i);
        dates.push(d);
      }
    }

    const recurringGroupId = isRecurring ? new mongoose.Types.ObjectId().toString() : undefined;
    for (const date of dates) {
      sessionsToCreate.push({
        employeeId: eid,
        employeeName: (employee as any).fullName,
        employeeRole: (employee as any).playbookRole || 'Member',
        conductedBy: user.id,
        conductedByName: user.fullName || 'Admin',
        scheduledAt: date,
        duration: duration || 30,
        meetingType: meetingType || 'in-person',
        meetingLink: meetingLink || '',
        status: 'scheduled',
        isRecurring: !!isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
        recurringGroupId,
        sharedNotes,
        actionItems,
        healthStatus: 'doing-well'
      });
    }

    const created = await CoachingSession.insertMany(sessionsToCreate);

    // Notification logic
    await NotificationService.createNotification({
      userId: employeeId,
      type: 'COACHING_SESSION',
      title: '1:1 Session Scheduled',
      message: `A session has been scheduled for ${new Date(scheduledAt).toLocaleDateString()}`,
      link: '/coaching',
      metadata: { sessionId: created[0]._id?.toString() },
    });

    return NextResponse.json({ ok: true, sessionId: created[0]._id?.toString(), sessions: created.map(s => normalizeSession(s)) });
  } catch (e) {
    console.error('[coaching POST]', e);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
