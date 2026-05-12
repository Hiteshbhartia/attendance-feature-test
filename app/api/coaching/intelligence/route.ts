import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Task from '@/models/Task';
import Tracker from '@/models/Tracker';
import CoachingSession from '@/models/CoachingSession';
import { getAuthUser } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { isElevated } from '@/lib/role-guards';

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 1000 * 60 * 5; 

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get('refresh') === 'true';

  if (!forceRefresh && cache && (Date.now() - cache.timestamp < CACHE_TTL)) {
    return NextResponse.json({ ok: true, data: cache.data, cached: true });
  }

  try {
    const user = await getAuthUser();
    
    // FAIL-SAFE: Admin check first
    const isSysAdmin = user && (user.role === 'admin' || user.systemRole === 'admin');
    
    const { canAccess, buildScopedEmployeeFilter } = await import('@/lib/permissions');
    const isAuthorized = isSysAdmin || (user && canAccess(user, 'MANAGE_TEAM_COACHING'));

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Coaching Intelligence] Auth Decision - User: ${user?.email}, Admin: ${isSysAdmin}, Authorized: ${isAuthorized}`);
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Coaching access required' }, { status: 403 });
    }

    await connectDB();

    // FAIL-SAFE Hierarchy Scope
    let filter: Record<string, any> = {};
    try {
      const scopedFilter = await buildScopedEmployeeFilter(user!);
      if (!scopedFilter) {
         if (isSysAdmin) {
           filter = {}; // Admin fallback to all
         } else {
           return NextResponse.json({ error: 'Unauthorized: No subtree access' }, { status: 403 });
         }
      } else {
        filter = scopedFilter;
      }
    } catch (err) {
      console.error('[Coaching Intelligence] Hierarchy resolution failed, falling back:', err);
      if (isSysAdmin) {
        filter = {}; // Failsafe for admin
      } else {
        // Safe fallback for managers: only self
        filter = { _id: user?.id };
      }
    }

    const employees = await User.find({ 
      ...filter,
      role: { $in: ['employee', 'manager', 'lead'] }
    })
    .select('fullName role _id')
    .lean()
    .limit(100);
    
    if (!employees.length) {
      return NextResponse.json({ ok: true, data: { needsAttention: [], highPerformers: [], onTrack: [], suggestedSessions: [], debug: [] } });
    }

    const employeeIds = employees.map(e => e._id);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Fetch all operational data AND latest coaching classifications
    const [allAttendances, allTasks, allTrackers, latestSessions] = await Promise.all([
      Attendance.find({ employeeId: { $in: employeeIds }, date: { $gte: thirtyDaysAgoStr } }).select('employeeId dayStatus date').lean(),
      Task.find({ assignedTo: { $in: employeeIds } }).select('assignedTo status dueDate').lean(),
      Tracker.find({ employeeId: { $in: employeeIds }, date: { $gte: thirtyDaysAgoStr } }).select('employeeId date').lean(),
      CoachingSession.aggregate([
        { $match: { employeeId: { $in: employeeIds }, status: { $ne: 'cancelled' } } },
        { $sort: { scheduledAt: -1 } },
        { $group: { _id: '$employeeId', latestHealth: { $first: '$healthStatus' }, latestDate: { $first: '$scheduledAt' } } }
      ])
    ]);

    const attMap: Record<string, any[]> = {};
    const taskMap: Record<string, any[]> = {};
    const trackMap: Record<string, any[]> = {};
    const healthMap: Record<string, any> = {};

    allAttendances.forEach(a => {
      const eid = a.employeeId?.toString();
      if (eid) {
        if (!attMap[eid]) attMap[eid] = [];
        attMap[eid].push(a);
      }
    });

    allTasks.forEach(t => {
      const eid = t.assignedTo?.toString();
      if (eid) {
        if (!taskMap[eid]) taskMap[eid] = [];
        taskMap[eid].push(t);
      }
    });

    allTrackers.forEach(tr => {
      const eid = tr.employeeId?.toString();
      if (eid) {
        if (!trackMap[eid]) trackMap[eid] = [];
        trackMap[eid].push(tr);
      }
    });

    latestSessions.forEach(s => {
      healthMap[s._id.toString()] = { status: s.latestHealth || 'doing-well', date: s.latestDate };
    });

    const needsAttention: any[] = [];
    const highPerformers: any[] = [];
    const onTrack: any[] = [];
    const suggestedSessions: any[] = [];
    const debug: any[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (const emp of employees as any[]) {
      const eidStr = emp._id.toString();
      const attendances = attMap[eidStr] || [];
      const tasks = taskMap[eidStr] || [];
      const trackers = trackMap[eidStr] || [];
      const manualHealth = healthMap[eidStr] || { status: 'doing-well' };

      let lateCount = 0, absentCount = 0, onTimeCount = 0;
      attendances.forEach(a => {
        if (a.dayStatus === 'Late') lateCount++;
        else if (a.dayStatus === 'Absent') absentCount++;
        else onTimeCount++;
      });

      let overdueCount = 0, completedCount = 0;
      tasks.forEach(t => {
        if (t.status === 'completed') completedCount++;
        else if (t.status === 'overdue' || (t.dueDate && t.dueDate < todayStr && t.status !== 'cancelled')) overdueCount++;
      });
      const taskCompletionRate = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

      const activeDays = attendances.filter(a => a.dayStatus !== 'Absent').length;
      const expectedEod = Math.max(1, activeDays);
      const eodConsistency = Math.round((trackers.length / expectedEod) * 100);

      // --- PERSISTENT CLASSIFICATION WEIGHTING ---
      let riskScore = 0;
      const riskBreakdown = [];
      
      // Manual Admin Overrides
      if (manualHealth.status === 'immediate-support') {
        riskScore += 60;
        riskBreakdown.push({ factor: 'Admin Critical Classification', impact: '+60', detail: 'Marked for Immediate Support in 1:1' });
      } else if (manualHealth.status === 'needs-attention') {
        riskScore += 30;
        riskBreakdown.push({ factor: 'Admin Warning Classification', impact: '+30', detail: 'Marked for Attention in 1:1' });
      }

      // Operational Signals
      if (lateCount > 0) {
        const val = lateCount * 10;
        riskScore += val;
        riskBreakdown.push({ factor: 'Repeated Late Logins', impact: `+${val}`, detail: `${lateCount} incidents` });
      }
      if (absentCount > 0) {
        const val = absentCount * 25;
        riskScore += val;
        riskBreakdown.push({ factor: 'Attendance Instability', impact: `+${val}`, detail: `${absentCount} unannounced absences` });
      }
      if (overdueCount > 0) {
        const val = overdueCount * 15;
        riskScore += val;
        riskBreakdown.push({ factor: 'Execution Delays', impact: `+${val}`, detail: `${overdueCount} overdue tasks` });
      }
      if (eodConsistency < 85 && expectedEod > 2) {
        const val = 30;
        riskScore += val;
        riskBreakdown.push({ factor: 'Reporting Discipline', impact: `+${val}`, detail: `Low EOD consistency (${eodConsistency}%)` });
      }

      let performanceScore = 0;
      const positiveFlags = [];
      if (lateCount === 0 && onTimeCount >= 5) { performanceScore += 30; positiveFlags.push('Perfect Attendance Record'); }
      if (taskCompletionRate > 90 && tasks.length >= 2) { performanceScore += 40; positiveFlags.push('High Task Velocity'); }
      if (eodConsistency >= 95 && activeDays >= 5) { performanceScore += 30; positiveFlags.push('Exceptional Accountability'); }

      const result = {
        employeeId: eidStr,
        employeeName: emp.fullName,
        manualHealth: manualHealth.status,
        stats: { lateLogins: lateCount, overdueTasks: overdueCount, taskCompletionRate: Math.round(taskCompletionRate), eodConsistency, absentCount },
        riskScore,
        performanceScore,
        riskBreakdown,
        positiveFlags,
        classification: riskScore >= 40 ? 'Needs Attention' : (performanceScore >= 60 ? 'High Performer' : 'On Track')
      };

      debug.push(result);

      if (result.classification === 'Needs Attention' || manualHealth.status !== 'doing-well') {
        needsAttention.push(result);
        suggestedSessions.push({ 
          employeeId: eidStr, 
          employeeName: emp.fullName, 
          type: manualHealth.status === 'immediate-support' ? 'Critical Intervention' : 'Performance Alignment', 
          severity: riskScore >= 100 ? 'high' : (riskScore >= 60 ? 'medium' : 'low'), 
          reasons: riskBreakdown.map(b => b.factor),
          riskScore: result.riskScore
        });
      } else if (result.classification === 'High Performer') {
        highPerformers.push(result);
        suggestedSessions.push({ 
          employeeId: eidStr, 
          employeeName: emp.fullName, 
          type: 'Growth & Recognition', 
          severity: 'low', 
          reasons: positiveFlags,
          riskScore: 0
        });
      } else {
        onTrack.push(result);
        if (onTrack.length % 5 === 0) {
          suggestedSessions.push({ 
            employeeId: eidStr, 
            employeeName: emp.fullName, 
            type: 'Routine Sync', 
            severity: 'low', 
            reasons: ['Steady Operational Performance'],
            riskScore: 0
          });
        }
      }
    }

    needsAttention.sort((a, b) => b.riskScore - a.riskScore);
    highPerformers.sort((a, b) => b.performanceScore - a.performanceScore);
    onTrack.sort((a, b) => b.stats.eodConsistency - a.stats.eodConsistency);
    
    suggestedSessions.sort((a, b) => {
      const sevOrder = { high: 0, medium: 1, low: 2 };
      const aSev = a.severity as keyof typeof sevOrder;
      const bSev = b.severity as keyof typeof sevOrder;
      if (sevOrder[aSev] !== sevOrder[bSev]) return sevOrder[aSev] - sevOrder[bSev];
      return b.riskScore - a.riskScore;
    });

    const duration = Date.now() - startTime;
    const finalData = {
      needsAttention,
      highPerformers,
      onTrack,
      suggestedSessions: suggestedSessions.slice(0, 9),
      debug,
      analysisInfo: { period: 'Last 30 Days', analyzedAt: new Date().toISOString(), employeeCount: employees.length, activeWithData: debug.length, computeTimeMs: duration }
    };

    cache = { data: finalData, timestamp: Date.now() };
    return NextResponse.json({ ok: true, data: finalData });

  } catch (error: any) {
    console.error('[Intelligence API] Error:', error.message);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
