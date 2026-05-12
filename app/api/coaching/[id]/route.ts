import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import CoachingSession from '@/models/CoachingSession';
import { getAuthUser } from '@/lib/auth';
import { isElevated } from '@/lib/role-guards';

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

// GET /api/coaching/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    await connectDB();

    const session = await CoachingSession.findById(id).lean();
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const isEmployee = user.role === 'employee';

    // Employees can only view their own sessions
    if (isEmployee && session.employeeId?.toString() !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ ok: true, session: normalizeSession(session, isEmployee) });
  } catch (e) {
    console.error('[coaching/:id GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/coaching/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    await connectDB();
    const session = await CoachingSession.findById(id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const isEmployee = user.role === 'employee';

    // Hierarchy check for managers/admin-level access
    const { canAccess, canAccessEmployeeData } = await import('@/lib/permissions');
    const isAuthorizedManager = !isEmployee && (
      user.role === 'admin' || 
      user.systemRole === 'admin' || 
      canAccess(user, 'MANAGE_TEAM_COACHING')
    );

    // Employees can only update their own sessions + only specific fields
    if (isEmployee) {
      if (session.employeeId?.toString() !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (isAuthorizedManager) {
       // Check if this manager can access this specific employee
       const hasAccess = await canAccessEmployeeData(user, session.employeeId.toString());
       if (!hasAccess) {
         return NextResponse.json({ error: 'Unauthorized: Session is for an employee outside your subtree' }, { status: 403 });
       }
    } else {
       return NextResponse.json({ error: 'Unauthorized to update coaching' }, { status: 403 });
    }

    const body = await req.json();

    if (isEmployee) {
      // Employees can only update action item statuses
      if (body.actionItemUpdate) {
        const { actionItemId, status, completedNote } = body.actionItemUpdate;
        const item = session.actionItems.find((a: any) => a._id?.toString() === actionItemId);
        if (!item) return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
        item.status = status;
        if (completedNote) item.completedNote = completedNote;
        if (status === 'completed' && !item.completedAt) item.completedAt = new Date();
        await session.save();
        return NextResponse.json({ ok: true, session: normalizeSession(session.toObject(), true) });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Admin/Manager: can update all fields
    const allowedFields = [
      'scheduledAt', 'duration', 'meetingType', 'meetingLink', 'status',
      'agendaItems', 'sharedNotes', 'privateNotes', 'discussionPoints',
      'healthStatus', 'healthNote', 'aiSummary', 'aiWins', 'aiBlockers', 'aiFollowUp',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (session as any)[field] = body[field];
      }
    }

    // Handle action items separately
    if (body.actionItems !== undefined) {
      session.actionItems = body.actionItems;
    }

    // Handle individual action item update
    if (body.actionItemUpdate) {
      const { actionItemId, status, completedNote } = body.actionItemUpdate;
      const item = session.actionItems.find((a: any) => a._id?.toString() === actionItemId);
      if (item) {
        if (status) item.status = status;
        if (completedNote) item.completedNote = completedNote;
        if (status === 'completed' && !item.completedAt) item.completedAt = new Date();
      }
    }

    await session.save();
    return NextResponse.json({ ok: true, session: normalizeSession(session.toObject(), false) });
  } catch (e) {
    console.error('[coaching/:id PATCH]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { canAccess, canAccessEmployeeData } = await import('@/lib/permissions');

    const isAuthorized = user && (
      user.role === 'admin' || 
      user.systemRole === 'admin' || 
      canAccess(user, 'MANAGE_TEAM_COACHING')
    );

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized to manage coaching' }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    await connectDB();
    const session = await CoachingSession.findById(id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Hierarchy check
    const hasAccess = await canAccessEmployeeData(user, session.employeeId.toString());
    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized: Session is for an employee outside your subtree' }, { status: 403 });
    }

    await session.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[coaching/:id DELETE]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
