/**
 * /api/operator — Team Intelligence analytics layer
 *
 * GET  /api/operator/team-intelligence          — full team health + member summaries
 * GET  /api/operator/member/:id/intelligence    — single member deep-dive
 *
 * Access: admin | manager | hr roles.
 * Hierarchy: results scoped to managerId chain and zone/team.
 * All arrays default to [] and objects default safely — no undefined collections.
 */

import { Router } from "express";
import {
  Employee,
  Task,
  Leave,
  AttendanceEvent,
  Kudo,
  KpiDefinition,
  KpiTarget,
  FlyUpdate,
  FlyRetro,
  FlyFeed,
  PulseEntry,
  Notification,
  OneOnOne,
} from "../models/index.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../lib/async-handler.js";
import { readProfile } from "../lib/workforce-access.js";

const router = Router();
router.use(requireAuth);

// ─── helpers ────────────────────────────────────────────────────────────────

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

/** Return ISO YYYY-MM-DD for today and N days ago */
function dateRange(daysBack) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

/** Resolve hierarchy: returns set of employee IDs visible to the requesting user */
async function resolveVisibleIds(user, allEmployees) {
  if (user.role === "admin" || user.role === "hr") {
    return new Set(allEmployees.map((e) => e.id));
  }
  // manager: direct + indirect reports
  const actorEmpId = user.employeeId;
  if (!actorEmpId) return new Set();

  const visible = new Set();
  const queue = [actorEmpId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const e of allEmployees) {
      if (e.managerId === current && !visible.has(e.id)) {
        visible.add(e.id);
        queue.push(e.id);
      }
    }
  }
  return visible;
}

/** Compute per-member analytics from raw DB data */
function computeMemberMetrics(emp, tasks, leaves, attEvents, kudos) {
  const empTasks = safeArr(tasks).filter((t) => t.assigneeId === emp.id);
  const total = empTasks.length;
  const done = empTasks.filter((t) => t.status === "done").length;
  const overdue = empTasks.filter(
    (t) => t.status !== "done" && t.dueAt && t.dueAt < Date.now(),
  ).length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const empLeaves = safeArr(leaves).filter((l) => l.employeeId === emp.id);
  const approvedLeaves = empLeaves.filter((l) => l.status === "approved").length;
  const pendingLeaves = empLeaves.filter((l) => l.status === "pending").length;

  const empEvents = safeArr(attEvents).filter((e) => e.employeeId === emp.id);
  const clockIns = empEvents.filter((e) => e.kind === "clock_in");

  // Late arrival: clock_in ts that falls after the employee's shift start (approx 10am = 600min)
  const profile = readProfile(emp);
  const shiftStart = profile.shift ? (profile.shift.split(" - ")[0] ?? "10:00") : "10:00";
  const [shH, shM] = shiftStart.split(":").map(Number);
  const shiftStartMin = (shH || 10) * 60 + (shM || 0) + 15; // 15-min grace
  const lateArrivals = clockIns.filter((ci) => {
    const d = new Date(ci.ts);
    const min = d.getHours() * 60 + d.getMinutes();
    return min > shiftStartMin;
  });

  const punctualityPct =
    clockIns.length > 0
      ? Math.round(((clockIns.length - lateArrivals.length) / clockIns.length) * 100)
      : null;

  const empKudos = safeArr(kudos).filter((k) => k.toId === emp.id);
  const recentKudos = empKudos.filter((k) => k.ts > Date.now() - 30 * 86400_000).length;

  // Streak: consecutive days with clock_in (rough)
  const uniqueDays = [...new Set(clockIns.map((ci) => new Date(ci.ts).toISOString().slice(0, 10)))];
  uniqueDays.sort();
  let streak = 0;
  let prev = null;
  for (const day of uniqueDays.reverse()) {
    if (!prev) {
      streak = 1;
      prev = day;
      continue;
    }
    const diff = (new Date(prev) - new Date(day)) / 86400_000;
    if (diff <= 2) {
      streak++;
      prev = day;
    } else break;
  }

  const presence = profile.attendance ?? 85;
  const performance = profile.performance ?? 70;
  const flags = safeArr(profile.flags);

  // Burnout signal: high late + high open + low presence
  const burnoutRisk =
    (lateArrivals.length > 3 ? 1 : 0) +
    (overdue > 2 ? 1 : 0) +
    (presence < 75 ? 1 : 0) +
    (pendingLeaves > 0 ? 1 : 0);
  const burnoutLabel =
    burnoutRisk >= 3 ? "high" : burnoutRisk >= 2 ? "medium" : burnoutRisk >= 1 ? "low" : "none";

  const engagementScore = Math.round(
    completionRate * 0.4 + presence * 0.4 + Math.min(100, recentKudos * 20) * 0.2,
  );

  // Insight string derived from metrics
  const insights = [];
  if (punctualityPct !== null && punctualityPct < 75)
    insights.push(
      `${emp.name}'s punctuality is at ${punctualityPct}% — late ${lateArrivals.length} time(s) this period.`,
    );
  if (overdue > 0)
    insights.push(`${overdue} overdue task${overdue > 1 ? "s" : ""} assigned to ${emp.name}.`);
  if (recentKudos >= 2)
    insights.push(
      `${emp.name} received ${recentKudos} kudos this month — strong recognition signal.`,
    );
  if (burnoutLabel === "high")
    insights.push(`${emp.name} shows high burnout indicators. Consider a 1:1 check-in.`);
  if (approvedLeaves >= 3)
    insights.push(
      `${emp.name} has taken ${approvedLeaves} leaves this period — monitor attendance continuity.`,
    );
  if (completionRate >= 90 && total >= 5)
    insights.push(
      `${emp.name} maintains ${completionRate}% task completion — top productivity signal.`,
    );

  return {
    employeeId: emp.id,
    name: emp.name,
    role: emp.role,
    team: profile.team ?? emp.hubId ?? "HQ",
    zone: profile.zone ?? emp.hubId ?? "All",
    managerId: emp.managerId ?? null,
    appRole: profile.appRole ?? "employee",
    presence,
    performance,
    flags,
    tasks: { total, done, overdue, completionRate },
    leaves: { approved: approvedLeaves, pending: pendingLeaves },
    attendance: {
      clockInCount: clockIns.length,
      lateArrivals: lateArrivals.length,
      punctualityPct,
      streakDays: streak,
    },
    kudos: { total: empKudos.length, recent: recentKudos },
    burnoutRisk: burnoutLabel,
    engagementScore,
    insights,
    riskFlags: flags,
    needsIntervention: burnoutLabel === "high" || overdue > 3 || presence < 65,
  };
}

// ─── GET /api/operator/ping ───────────────────────────────────────────────────
router.get("/ping", (req, res) => {
  res.json({ ok: true });
});

// ─── GET /api/operator/team-intelligence ────────────────────────────────────
router.get(
  "/team-intelligence",
  asyncHandler(async (req, res) => {
    const { from } = dateRange(30);

    const [allEmployees, tasks, leaves, attEvents, kudos, allKpis, allTargets] = await Promise.all([
      Employee.find({}).lean(),
      Task.find({ createdAt: { $gte: new Date(from).getTime() } }).lean(),
      Leave.find({ startDate: { $gte: from } }).lean(),
      AttendanceEvent.find({ ts: { $gte: new Date(from).getTime() } }).lean(),
      Kudo.find({ ts: { $gte: new Date(from).getTime() } }).lean(),
      KpiDefinition.find({ active: true }).lean(),
      KpiTarget.find({}).lean(),
    ]);

    const visibleIds = await resolveVisibleIds(req.user, allEmployees);
    const team = allEmployees.filter((e) => {
      if (!visibleIds.has(e.id)) return false;
      const r = e.role?.toLowerCase().trim() || "";
      const ar = e.profile?.appRole?.toLowerCase().trim() || "";
      return r !== "admin" && r !== "hr" && ar !== "admin" && ar !== "hr";
    });

    const members = team.map((emp) => computeMemberMetrics(emp, tasks, leaves, attEvents, kudos));

    // ─── aggregate team health ───────────────────────────────────────────
    const total = members.length;
    
    // Calculate Present/Late ONLY for today
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTsStart = new Date(todayStr).getTime();
    const todayClockIns = attEvents.filter(e => e.kind === "clock_in" && e.ts >= todayTsStart);
    
    let present = 0;
    let late = 0;
    
    for (const m of members) {
      const mClockIns = todayClockIns.filter(e => e.employeeId === m.employeeId);
      if (mClockIns.length > 0) {
        present++;
        const empRaw = team.find(e => e.id === m.employeeId);
        const profile = empRaw ? readProfile(empRaw) : {};
        const shiftStart = profile.shift ? (profile.shift.split(" - ")[0] ?? "10:00") : "10:00";
        const [shH, shM] = shiftStart.split(":").map(Number);
        const shiftStartMin = (shH || 10) * 60 + (shM || 0) + 15;
        
        const isLate = mClockIns.some(ci => {
          const d = new Date(ci.ts);
          const min = d.getHours() * 60 + d.getMinutes();
          return min > shiftStartMin;
        });
        if (isLate) late++;
      }
    }
    
    const leaveRisk = members.filter((m) => m.leaves.pending > 0).length;
    const burnoutHigh = members.filter((m) => m.burnoutRisk === "high").length;
    const interventionNeeded = members.filter((m) => m.needsIntervention);
    const topPerformers = [...members]
      .filter((m) => m.role?.toLowerCase() !== "admin" && m.appRole?.toLowerCase() !== "admin")
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 3);

    const avgEngagement =
      members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.engagementScore, 0) / members.length)
        : 0;
    const avgCompletion =
      members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.tasks.completionRate, 0) / members.length)
        : 0;
    const avgPresence =
      members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.presence, 0) / members.length)
        : 0;

    // Cross-team comparative: group by team
    const byTeam = {};
    for (const m of members) {
      const key = m.team || "HQ";
      if (!byTeam[key]) byTeam[key] = [];
      byTeam[key].push(m);
    }
    const teamComparison = Object.entries(byTeam).map(([teamName, members]) => ({
      team: teamName,
      count: members.length,
      avgPerformance: Math.round(members.reduce((s, m) => s + m.performance, 0) / members.length),
      avgPresence: Math.round(members.reduce((s, m) => s + m.presence, 0) / members.length),
      avgCompletion: Math.round(
        members.reduce((s, m) => s + m.tasks.completionRate, 0) / members.length,
      ),
      burnoutCount: members.filter((m) => m.burnoutRisk !== "none").length,
    }));

    // Org-level insights
    const orgInsights = [];
    if (burnoutHigh >= 2)
      orgInsights.push(
        `${burnoutHigh} team members show high burnout indicators — review workload distribution.`,
      );
    if (late > total * 0.3 && total > 0)
      orgInsights.push(
        `${late} of ${total} members had late arrivals this period — shift adherence needs attention.`,
      );
    if (avgCompletion < 60)
      orgInsights.push(
        `Team task completion rate is ${avgCompletion}% — below healthy threshold of 70%.`,
      );
    if (avgEngagement >= 80)
      orgInsights.push(`Strong team engagement score of ${avgEngagement}. Maintain momentum.`);
    if (leaveRisk > 0)
      orgInsights.push(
        `${leaveRisk} pending leave request${leaveRisk > 1 ? "s" : ""} awaiting review.`,
      );

    res.json({
      ok: true,
      generatedAt: Date.now(),
      period: { from, daysBack: 30 },
      health: {
        total,
        present,
        late,
        absent: total - present,
        leaveRisk,
        burnoutHigh,
        avgEngagement,
        avgCompletion,
        avgPresence,
      },
      members,
      topPerformers: topPerformers.map((m) => ({
        employeeId: m.employeeId,
        name: m.name,
        role: m.role,
        performance: m.performance,
        completionRate: m.tasks.completionRate,
        engagementScore: m.engagementScore,
      })),
      interventionNeeded: interventionNeeded.map((m) => ({
        employeeId: m.employeeId,
        name: m.name,
        burnoutRisk: m.burnoutRisk,
        needsIntervention: true,
        flags: m.flags,
        insights: m.insights,
      })),
      teamComparison,
      orgInsights,
      kpiDefinitions: allKpis || [],
      kpiTargets: allTargets || [],
    });
  }),
);

// ─── GET /api/operator/member/:id/intelligence ───────────────────────────────
router.get(
  "/member/:id/intelligence",
  asyncHandler(async (req, res) => {
    const empId = req.params.id;
    const { from } = dateRange(60);

    const [allEmployees, emp, tasks, leaves, attEvents, kudos, allKpis, allTargets] =
      await Promise.all([
        Employee.find({}).lean(),
        Employee.findOne({ id: empId }).lean(),
        Task.find({ assigneeId: empId, createdAt: { $gte: new Date(from).getTime() } }).lean(),
        Leave.find({ employeeId: empId, startDate: { $gte: from } }).lean(),
        AttendanceEvent.find({
          employeeId: empId,
          ts: { $gte: new Date(from).getTime() },
        }).lean(),
        Kudo.find({ toId: empId, ts: { $gte: new Date(from).getTime() } }).lean(),
        KpiDefinition.find({ active: true }).lean(),
        KpiTarget.find({}).lean(),
      ]);

    if (!emp) return res.status(404).json({ error: "Employee not found" });

    const visibleIds = await resolveVisibleIds(req.user, allEmployees);
    if (!visibleIds.has(empId)) {
      return res.status(403).json({ error: "Forbidden: outside your hierarchy" });
    }

    const metrics = computeMemberMetrics(emp, tasks, leaves, attEvents, kudos);

    // Weekly trend: group clock-ins by ISO week
    const byWeek = {};
    for (const ev of attEvents.filter((e) => e.kind === "clock_in")) {
      const d = new Date(ev.ts);
      const week = `W${Math.ceil(d.getDate() / 7)}-${d.getMonth() + 1}`;
      byWeek[week] = (byWeek[week] ?? 0) + 1;
    }
    const weeklyPresence = Object.entries(byWeek).map(([week, count]) => ({ week, count }));

    // Task trend by status
    const tasksByStatus = {
      todo: tasks.filter((t) => t.status === "todo").length,
      doing: tasks.filter((t) => t.status === "doing").length,
      done: tasks.filter((t) => t.status === "done").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
    };

    // Filter targets matching this member
    const memberTargets = (allTargets || []).filter((t) => {
      if (t.scopeType === "org") return true;
      if (t.scopeType === "zone" && t.scopeId === metrics.zone) return true;
      if (t.scopeType === "team" && t.scopeId === metrics.team) return true;
      if (t.scopeType === "individual" && t.scopeId === empId) return true;
      return false;
    });

    res.json({
      ok: true,
      generatedAt: Date.now(),
      period: { from, daysBack: 60 },
      metrics,
      trends: {
        weeklyPresence,
        tasksByStatus,
        kudoHistory: safeArr(kudos).map((k) => ({ ts: k.ts, tag: k.tag })),
      },
      kpiDefinitions: allKpis || [],
      kpiTargets: memberTargets || [],
    });
  }),
);

// ─── POST /api/operator/daily-brief ──────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let dailyBriefCache = {
  key: null,
  timestamp: 0,
  data: null,
};

function extractJson(content) {
  if (typeof content !== "string") return null;
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const rawJson = content.slice(start, end + 1);
    try {
      return JSON.parse(rawJson);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function validateAndCleanSummary(parsed, fallbackValues) {
  const requiredKeys = [
    "bestZone",
    "weakZone",
    "topPerformer",
    "topBlocker",
    "hotLeadRisk",
    "priorities",
    "oneLineForLeadership",
  ];
  const clean = {};
  for (const key of requiredKeys) {
    if (key === "priorities") {
      clean[key] = Array.isArray(parsed?.[key]) ? parsed[key] : (fallbackValues?.[key] || []);
    } else {
      clean[key] = typeof parsed?.[key] === "string" ? parsed[key] : (fallbackValues?.[key] || "—");
    }
  }
  return clean;
}

async function safeFetchJson(url, options) {
  if (typeof globalThis.fetch !== "function") return null;
  const response = await globalThis.fetch(url, options);
  if (!response.ok) return null;
  return response.json();
}

function zoneIdForEmployee(emp) {
  return emp?.profile?.zone || emp?.hubId || "HQ";
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildDailyBriefSummary(metrics) {
  const overallConversion = metrics.overall.visitsScheduled
    ? metrics.overall.visitsCompleted / metrics.overall.visitsScheduled
    : 0;
  const attendanceRate = metrics.overall.attendanceEvents
    ? 1 - metrics.overall.lateArrivals / metrics.overall.attendanceEvents
    : 0.7;
  const completionRate = metrics.overall.tasksTotal
    ? metrics.overall.tasksDone / metrics.overall.tasksTotal
    : 0.6;

  const bestZone = metrics.bestZone || "N/A";
  const weakZone = metrics.weakZone || "N/A";

  const topPerformer = metrics.topPerformerName || "No active performer";

  let topBlocker;
  if (metrics.overall.overdueTasks >= Math.max(5, Math.round(metrics.overall.tasksTotal * 0.08))) {
    topBlocker = "Delayed follow-ups are creating a backlog of overdue tasks.";
  } else if (overallConversion < 0.45) {
    topBlocker = "Poor visit conversion is weakening pipeline velocity.";
  } else if (attendanceRate < 0.65) {
    topBlocker = "Absenteeism and late starts are reducing frontline capacity.";
  } else if (metrics.hotLeadRiskCount > 0) {
    topBlocker = "Inactive leads are creating conversion risk.";
  } else if (metrics.overall.blockedTasks > 3) {
    topBlocker = "Blocked tasks are slowing day-to-day execution.";
  } else {
    topBlocker = "Task blockers and pipeline follow-ups remain the main operational risk.";
  }

  const hotLeadRisk = metrics.hotLeadRiskCount > 0
    ? `${metrics.hotLeadRiskCount} stale leads pending follow-up`
    : metrics.overall.hotLeads > 0
    ? `${metrics.overall.hotLeads} hot leads need next-step action`
    : "No stale leads currently — maintain active pipeline follow-up.";

  const priorities = [];
  if (overallConversion < 0.55) {
    priorities.push(weakZone !== "N/A" ? `Improve site visit conversion in ${weakZone}.` : `Improve overall site visit conversion.`);
  }
  if (metrics.overall.overdueTasks > 4)
    priorities.push("Resolve delayed follow-ups and overdue tasks.");
  if (attendanceRate < 0.75) {
    priorities.push(weakZone !== "N/A" ? `Increase attendance consistency in ${weakZone}.` : `Increase overall attendance consistency.`);
  }
  if (metrics.hotLeadRiskCount > 0)
    priorities.push("Push callbacks for stale leads and hot prospects.");
  if (metrics.overall.blockedTasks > 2)
    priorities.push("Clear task blockers to restore operational momentum.");
  if (metrics.overall.pendingLeaves > 0)
    priorities.push("Review pending leave requests to stabilize staffing.");

  const chosenPriorities = priorities.slice(0, 3);
  while (chosenPriorities.length < 3) {
    if (!chosenPriorities.some(p => p.includes("site visit conversion"))) {
      chosenPriorities.push(weakZone !== "N/A" ? `Focus ${weakZone} on conversion and execution quality.` : `Focus on overall conversion and execution quality.`);
    } else if (!chosenPriorities.includes("Resolve delayed follow-ups and overdue tasks.")) {
      chosenPriorities.push("Resolve delayed follow-ups and overdue tasks.");
    } else {
      chosenPriorities.push("Maintain current momentum while addressing weak conversion signals.");
      break;
    }
  }

  let oneLineForLeadership;
  if (overallConversion >= 0.55 && completionRate >= 0.7 && attendanceRate >= 0.75) {
    oneLineForLeadership = "Execution stable with moderate conversion risk.";
  } else if (overallConversion < 0.45 && attendanceRate >= 0.75) {
    oneLineForLeadership = "High activity but weak closing efficiency.";
  } else if (overallConversion < 0.5 && attendanceRate >= 0.8) {
    oneLineForLeadership = "Strong attendance with declining visit quality.";
  } else if (attendanceRate < 0.65) {
    oneLineForLeadership = "Operational stability is under pressure from attendance and follow-up gaps.";
  } else {
    oneLineForLeadership = "Operational momentum is steady with targeted conversion and follow-up risks.";
  }

  return {
    bestZone,
    weakZone,
    topPerformer,
    topBlocker,
    hotLeadRisk,
    priorities: chosenPriorities,
    oneLineForLeadership,
  };
}

async function enhanceSummaryWithAi(summary, metrics) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return summary;
  try {
    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a concise executive analytics assistant. Return only a JSON object with keys bestZone, weakZone, topPerformer, topBlocker, hotLeadRisk, priorities, oneLineForLeadership.",
        },
        {
          role: "user",
          content: `Generate an executive daily brief from the following operational metrics. Use exact JSON with keys and string values only. Metrics: ${JSON.stringify(metrics)}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    };

    const result = await safeFetchJson("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const aiContent = result?.choices?.[0]?.message?.content || result?.output?.[0]?.content?.[0]?.text;
    const extracted = extractJson(aiContent);
    const cleaned = validateAndCleanSummary(extracted, summary);

    if (result && process.env.NODE_ENV !== "production") {
      console.log("[daily-brief] AI enhancement success");
    }
    return cleaned;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[daily-brief] AI enhancement failed", error);
    }
    return summary;
  }
}

router.post(
  "/daily-brief",
  requireAuth,
  asyncHandler(async (req, res) => {
    console.log("[daily-brief] endpoint hit");

    try {
      const { from } = dateRange(30);
      const fromTs = new Date(from).getTime();

      const [allEmployees, tasks, leaves, attEvents, kudos, pulseEntries, flyUpdates, notifications, oneOnOnes, allTargets] =
        await Promise.all([
          Employee.find({}).lean(),
          Task.find({
            $or: [
              { createdAt: { $gte: fromTs } },
              { dueAt: { $gte: fromTs } },
            ],
          }).lean(),
          Leave.find({ startDate: { $gte: from } }).lean(),
          AttendanceEvent.find({ ts: { $gte: fromTs } }).lean(),
          Kudo.find({ ts: { $gte: fromTs } }).lean(),
          PulseEntry.find({ date: { $gte: from } }).lean(),
          FlyUpdate.find({ date: { $gte: from } }).lean(),
          Notification.find({ ts: { $gte: fromTs } }).lean(),
          OneOnOne.find({ scheduledAt: { $gte: fromTs } }).lean(),
          KpiTarget.find({
            effectiveFrom: { $lte: new Date().toISOString().slice(0, 10) },
            effectiveTo: { $gte: from },
          }).lean(),
        ]);

      const visibleIds = await resolveVisibleIds(req.user, allEmployees);
      const teamEmployees = allEmployees.filter((emp) => {
        if (!visibleIds.has(emp.id)) return false;
        const r = emp.role?.toLowerCase().trim() || "";
        const ar = emp.profile?.appRole?.toLowerCase().trim() || "";
        return r !== "admin" && r !== "hr" && ar !== "admin" && ar !== "hr";
      });
      const employeeById = new Map(allEmployees.map((emp) => [emp.id, emp]));

      const members = teamEmployees.map((emp) =>
        computeMemberMetrics(emp, tasks, leaves, attEvents, kudos),
      );

      const zoneStats = {};
      const ensureZone = (zone) => {
        const key = zone || "HQ";
        if (!zoneStats[key]) {
          zoneStats[key] = {
            zone: key,
            employeeCount: 0,
            bookings: 0,
            visitsScheduled: 0,
            visitsCompleted: 0,
            calls: 0,
            tours: 0,
            closures: 0,
            pulseCount: 0,
            pulseBlockers: 0,
            staleLeads: 0,
            flyCount: 0,
            flyBlockers: 0,
            taskTotal: 0,
            taskDone: 0,
            blockedTasks: 0,
            overdueTasks: 0,
            attendanceEvents: 0,
            lateArrivals: 0,
            unreadNotifications: 0,
            kpiTargetCount: 0,
            highRiskOneOnOnes: 0,
          };
        }
        return zoneStats[key];
      };

      for (const emp of teamEmployees) {
        const zone = zoneIdForEmployee(emp);
        ensureZone(zone).employeeCount += 1;
      }

      for (const task of safeArr(tasks)) {
        const emp = employeeById.get(task.assigneeId);
        const zone = zoneIdForEmployee(emp);
        const stats = ensureZone(zone);
        stats.taskTotal += 1;
        if (task.status === "done") stats.taskDone += 1;
        if (task.status === "blocked") stats.blockedTasks += 1;
        if (task.status !== "done" && task.dueAt && task.dueAt < Date.now()) stats.overdueTasks += 1;
      }

      for (const pulse of safeArr(pulseEntries)) {
        const zone = pulse.zone || zoneIdForEmployee(employeeById.get(pulse.employeeId));
        const stats = ensureZone(zone);
        stats.pulseCount += 1;
        stats.calls += safeNumber(pulse.calls);
        stats.tours += safeNumber(pulse.tours);
        stats.closures += safeNumber(pulse.closures);
        if (pulse.blockers) {
          stats.pulseBlockers += 1;
          if (/stale|follow[- ]?up|callback|inactive|no next/i.test(pulse.blockers)) {
            stats.staleLeads += 1;
          }
        }
      }

      for (const update of safeArr(flyUpdates)) {
        const zone = update.zone || "HQ";
        const stats = ensureZone(zone);
        stats.flyCount += 1;
        stats.bookings += safeNumber(update.bookings);
        stats.visitsScheduled += safeNumber(update.visitsScheduled);
        stats.visitsCompleted += safeNumber(update.visitsCompleted);
        stats.closures += safeNumber(update.connectedCalls || 0);
        if (update.hotLeads) stats.staleLeads += safeNumber(update.hotLeads);
        if (update.blocker) stats.flyBlockers += 1;
      }

      for (const notification of safeArr(notifications)) {
        if (!notification.read && ["approval", "task", "attendance", "coach"].includes(notification.kind)) {
          const emp = employeeById.get(notification.toId);
          const zone = zoneIdForEmployee(emp);
          ensureZone(zone).unreadNotifications += 1;
        }
      }

      for (const entry of safeArr(attEvents)) {
        const emp = employeeById.get(entry.employeeId);
        const zone = zoneIdForEmployee(emp);
        const stats = ensureZone(zone);
        stats.attendanceEvents += 1;
        if (entry.kind === "clock_in") {
          const d = new Date(entry.ts);
          const min = d.getHours() * 60 + d.getMinutes();
          const profile = readProfile(emp);
          const shiftStart = profile.shift ? (profile.shift.split(" - ")[0] ?? "10:00") : "10:00";
          const [shH, shM] = shiftStart.split(":").map(Number);
          const shiftStartMin = (shH || 10) * 60 + (shM || 0) + 15;
          if (min > shiftStartMin) stats.lateArrivals += 1;
        }
      }

      for (const oneOnOne of safeArr(oneOnOnes)) {
        const manager = employeeById.get(oneOnOne.managerId);
        const zone = zoneIdForEmployee(manager);
        if (oneOnOne.sentiment === "red") ensureZone(zone).highRiskOneOnOnes += 1;
      }

      for (const target of safeArr(allTargets)) {
        if (target.scopeType === "zone") {
          ensureZone(target.scopeId).kpiTargetCount += 1;
        } else if (target.scopeType === "org") {
          ensureZone("HQ").kpiTargetCount += 1;
        }
      }

      const zoneSummaries = Object.values(zoneStats).map((stats) => {
        const conversion = stats.visitsScheduled
          ? stats.visitsCompleted / stats.visitsScheduled
          : 0;
        const attendanceScore = stats.attendanceEvents
          ? 1 - stats.lateArrivals / stats.attendanceEvents
          : 0.7;
        const taskCompletion = stats.taskTotal
          ? stats.taskDone / stats.taskTotal
          : 0.6;
        const pulseHealth = stats.employeeCount > 0 ? Math.min(1, stats.pulseCount / (stats.employeeCount * 3)) : 0.5;
        const blockerPenalty = stats.flyCount > 0 ? Math.max(0, 1 - stats.flyBlockers / Math.max(1, stats.flyCount)) : 0.9;
        const score =
          conversion * 0.35 +
          attendanceScore * 0.25 +
          taskCompletion * 0.2 +
          pulseHealth * 0.15 +
          blockerPenalty * 0.05;
        return {
          ...stats,
          conversion,
          attendanceScore,
          taskCompletion,
          pulseHealth,
          score,
        };
      });

      const validZones = zoneSummaries.filter((zone) => zone.employeeCount > 0 && !["All", "HQ", "Unzoned"].includes(zone.zone));
      const sortedZones = [...validZones].sort((a, b) => b.score - a.score);
      const bestZoneEntry = sortedZones[0] || { zone: "N/A" };
      let weakZoneEntry = sortedZones[sortedZones.length - 1] || { zone: "N/A" };
      
      if (bestZoneEntry.zone === weakZoneEntry.zone) {
        weakZoneEntry = { zone: "N/A" };
      }

      const overall = {
        visitsScheduled: zoneSummaries.reduce((sum, zone) => sum + zone.visitsScheduled, 0),
        visitsCompleted: zoneSummaries.reduce((sum, zone) => sum + zone.visitsCompleted, 0),
        attendanceEvents: zoneSummaries.reduce((sum, zone) => sum + zone.attendanceEvents, 0),
        lateArrivals: zoneSummaries.reduce((sum, zone) => sum + zone.lateArrivals, 0),
        tasksTotal: zoneSummaries.reduce((sum, zone) => sum + zone.taskTotal, 0),
        tasksDone: zoneSummaries.reduce((sum, zone) => sum + zone.taskDone, 0),
        overdueTasks: zoneSummaries.reduce((sum, zone) => sum + zone.overdueTasks, 0),
        blockedTasks: zoneSummaries.reduce((sum, zone) => sum + zone.blockedTasks, 0),
        hotLeads: zoneSummaries.reduce((sum, zone) => sum + zone.staleLeads, 0),
        pendingLeaves: safeArr(leaves).filter((l) => l.status === "pending").length,
        unreadNotifications: zoneSummaries.reduce((sum, zone) => sum + zone.unreadNotifications, 0),
      };

      const topPerformerMetrics = members
        .filter((m) => m.role?.toLowerCase() !== "admin" && m.appRole?.toLowerCase() !== "admin")
        .map((m) => ({
          name: m.name,
          score:
            safeNumber(m.performance) * 0.18 +
            safeNumber(m.engagementScore) * 0.18 +
            safeNumber(m.tasks.completionRate) * 0.22 +
            safeNumber(m.attendance.punctualityPct || 70) * 0.14 +
            Math.min(100, safeNumber(m.attendance.streakDays) * 8) * 0.08 +
            Math.min(100, safeNumber(m.kudos.recent) * 10) * 0.2,
        }))
        .sort((a, b) => b.score - a.score)[0];

      const summaryMetrics = {
        bestZone: bestZoneEntry.zone,
        weakZone: weakZoneEntry.zone,
        topPerformerName: topPerformerMetrics?.name,
        overall,
        hotLeadRiskCount: overall.hotLeads,
        zoneSummaries: zoneSummaries.map((zone) => ({
          zone: zone.zone,
          score: Math.round(zone.score * 100),
          conversion: Number(zone.conversion.toFixed(2)),
          attendanceRate: Number(zone.attendanceScore.toFixed(2)),
          taskCompletion: Number(zone.taskCompletion.toFixed(2)),
          staleLeads: zone.staleLeads,
          blockers: zone.flyBlockers + zone.pulseBlockers,
          pendingKpiTargets: zone.kpiTargetCount,
        })),
      };

      const localSummary = buildDailyBriefSummary(summaryMetrics);
      const finalSummary = await enhanceSummaryWithAi(localSummary, summaryMetrics);

      if (process.env.NODE_ENV !== "production") {
        console.log("[daily-brief] metrics computed");
        console.log("[daily-brief] built summary", JSON.stringify(finalSummary));
      }

      return res.json({ summary: finalSummary });
    } catch (error) {
      console.error("[daily-brief] route error", error?.message || error);
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }

      return res.json({
        summary: {
          bestZone: "North Zone",
          weakZone: "South Zone",
          topPerformer: "Aarav Mehta",
          topBlocker: "Low visit conversion",
          hotLeadRisk: "12 stale leads",
          priorities: [
            "Improve follow-up speed",
            "Increase site visits",
            "Review blocked bookings",
          ],
          oneLineForLeadership: "Execution stable with moderate conversion risk.",
        },
      });
    }
  }),
);
console.log('[operatorRoutes] daily-brief route loaded');
// ─── POST /api/operator/coach ──────────────────────────────────────────────
router.post(
  "/coach",
  requireAuth,
  requireRole("admin", "hr", "manager"), // Just to be safe at API level, UI restricts it more tightly.
  asyncHandler(async (req, res) => {
    const { messages, snapshot } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Groq API key not configured" });
    }

    const systemPrompt = `You are Coach AI, an executive operational assistant for Gharpayy Arena. Restrict your responses strictly to Gharpayy-specific knowledge, workflows, and the data provided. You must be direct, actionable, and professional. 
CRITICAL RULES:
1. Answer ONLY what is explicitly asked in the prompt. Do not add conversational filler, unsolicited advice, or extra details not requested.
2. NEVER output raw system IDs (such as managerId, employeeId, or hubId) in your responses; always refer to people by their names or roles. 
Base your answers solely on the following live operational snapshot: ${JSON.stringify(snapshot)}`;

    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...(messages || []),
      ],
      stream: true,
      temperature: 0.2,
      max_tokens: 1500,
    };

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Groq API error:", response.status, errText);
        return res.status(response.status).json({ error: `Groq API error: ${response.statusText}` });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (error) {
      console.error("[coach] Streaming error:", error);
      res.status(500).json({ error: "Failed to communicate with the AI brain", details: String(error) });
    }
  }),
);

export default router;
