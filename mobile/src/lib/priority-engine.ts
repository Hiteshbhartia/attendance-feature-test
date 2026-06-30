// Role-aware Mission Brief.
// Replaces "Today's Mission" placeholders with a ranked list of real,
// actionable items derived from live stores. Every item has a deeplink.

import type { Employee } from "@/types/hr";
import { getRoster } from "@/lib/roster";
import { tierOf, type Tier } from "./permissions";
import { tasksFor, tasksAssignedBy } from "./task-store";
import { recentEvents } from "./event-bus";
import { api } from "./api-client";
import { getEntries, todayISO } from "./pulse-store";

export type MissionItem = {
  id: string;
  weight: number; // higher = more urgent
  kicker: string; // small label, e.g. "SLA · 12m left"
  title: string;
  body?: string;
  to: string;
  tone: "urgent" | "warn" | "info" | "neutral";
};

const H = 3600_000;

// CACHE: Prevent burning through API limits
const aiCache: Record<string, { ts: number; items: MissionItem[] | null }> = {};

export async function fetchAiMissionFor(actor: Employee): Promise<MissionItem[]> {
  try {
    const now = Date.now();
    if (aiCache[actor.id] && now - aiCache[actor.id].ts < 5 * 60_000) {
      const cachedItems = aiCache[actor.id].items;
      if (cachedItems) return [...cachedItems];
      return fallbackMissionFor(actor); 
    }

    const myTasks = tasksFor(actor.id).filter((t) => t.status !== "done");
    const assignedTasks = tasksAssignedBy(actor.id).filter((t) => t.status !== "done");
    const pulses = getEntries({ employeeId: actor.id, date: todayISO() });
    
    const cleanMyTasks = myTasks.slice(0, 10).map((t) => ({ id: t.id, title: t.title, status: t.status }));
    const cleanAssignedTasks = assignedTasks.slice(0, 10).map((t) => ({ id: t.id, title: t.title, assignee: t.assigneeId }));
    const events = recentEvents().slice(0, 5);
    const cleanPulses = pulses.slice(0, 5).map((p) => ({ id: p.id, text: p.text, blockers: p.blockers, slot: p.slot }));

    const d = new Date();
    const currentHour = d.getHours();
    const currentMin = d.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
    let timeSlot = "morning";
    if (currentHour >= 12 && currentHour < 17) timeSlot = "midday";
    else if (currentHour >= 17) timeSlot = "eod";

    const result = await api.post<MissionItem[]>("/ai/priorities", {
      actor: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
        team: actor.team,
        tier: tierOf(actor),
      },
      myTasks: cleanMyTasks,
      assignedTasks: cleanAssignedTasks,
      events,
      pulses: cleanPulses,
      currentTime,
      timeSlot
    });
    
    if (Array.isArray(result) && result.length > 0) {
      const sorted = result.sort((a, b) => b.weight - a.weight);
      aiCache[actor.id] = { ts: Date.now(), items: sorted };
      return sorted;
    }
    
    aiCache[actor.id] = { ts: Date.now(), items: null };
    return fallbackMissionFor(actor);
  } catch (err) {
    aiCache[actor.id] = { ts: Date.now(), items: null };
    return fallbackMissionFor(actor);
  }
}

export function fallbackMissionFor(actor: Employee): MissionItem[] {
  const tier = tierOf(actor);
  const items: MissionItem[] = [];
  const now = Date.now();

  // --- Personal: tasks due / overdue / urgent ---
  const my = tasksFor(actor.id).filter((t) => t.status !== "done");
  for (const t of my) {
    const overdue = t.dueAt < now;
    const dueSoon = t.dueAt - now < 2 * H;
    if (overdue) {
      items.push({
        id: `task-od-${t.id}`,
        weight: 100 + (t.priority === "urgent" ? 20 : 0),
        kicker: `Overdue · ${Math.round((now - t.dueAt) / 60000)}m`,
        title: t.title,
        body: t.relatedTo,
        to: "/tasks",
        tone: "urgent",
      });
    } else if (dueSoon || t.priority === "urgent") {
      items.push({
        id: `task-soon-${t.id}`,
        weight: 70 + (t.priority === "urgent" ? 15 : 0),
        kicker:
          t.priority === "urgent" ? "Urgent" : `Due in ${Math.round((t.dueAt - now) / 60000)}m`,
        title: t.title,
        body: t.relatedTo,
        to: "/tasks",
        tone: t.priority === "urgent" ? "urgent" : "warn",
      });
    }
  }

  // --- Tier-specific event feeds ---
  const events = recentEvents(80);

  if (tier === "leadership") {
    // Show org-wide escalations + open ops items
    for (const e of events.filter((x) => x.kind === "ops.escalated").slice(0, 4)) {
      items.push({
        id: `ev-${e.id}`,
        weight: 90,
        kicker: "Escalated",
        title: e.title,
        body: e.body,
        to: e.deeplink ?? "/war-room",
        tone: "urgent",
      });
    }
  }

  if (tier === "zone_leader" || tier === "leader") {
    // Blockers from this zone
    for (const e of events
      .filter(
        (x) =>
          x.kind === "blocker.raised" &&
          (!actor.zone || x.zone === actor.zone || actor.zone === "All"),
      )
      .slice(0, 4)) {
      items.push({
        id: `blk-${e.id}`,
        weight: 85,
        kicker: `Blocker · ${e.zone ?? "—"}`,
        title: e.title,
        body: e.body,
        to: "/fly",
        tone: "warn",
      });
    }
    for (const e of events.filter((x) => x.kind === "partner.ticket.opened").slice(0, 3)) {
      items.push({
        id: `pt-${e.id}`,
        weight: 75,
        kicker: `Partner · ${e.severity ?? "med"}`,
        title: e.title,
        body: e.body,
        to: "/tickets",
        tone: e.severity === "urgent" ? "urgent" : "warn",
      });
    }
  }

  if (tier === "hr") {
    for (const e of events.filter((x) => x.kind === "leave.requested").slice(0, 5)) {
      items.push({
        id: `lv-${e.id}`,
        weight: 70,
        kicker: "Leave · pending",
        title: e.title,
        body: e.body,
        to: "/leaves",
        tone: "warn",
      });
    }
    for (const e of events.filter((x) => x.kind === "attendance.late").slice(0, 3)) {
      items.push({
        id: `at-${e.id}`,
        weight: 50,
        kicker: "Attendance",
        title: e.title,
        body: e.body,
        to: "/attendance",
        tone: "info",
      });
    }
  }

  if (tier === "recruiter") {
    items.push({
      id: "rec-board",
      weight: 60,
      kicker: "Funnel",
      title: "Review today's pipeline",
      body: "Source → screen → seal — move every card one stage.",
      to: "/recruiting",
      tone: "info",
    });
  }

  if (tier === "partner") {
    for (const e of events
      .filter((x) => x.kind === "partner.ticket.opened" && x.actorId === actor.id)
      .slice(0, 3)) {
      items.push({
        id: `mt-${e.id}`,
        weight: 60,
        kicker: "Your request · in queue",
        title: e.title,
        body: e.body,
        to: "/partner",
        tone: "info",
      });
    }
  }

  // --- Global: Tasks I Assigned ---
  // If employee assigned a task, show it in home section
  const roster = getRoster();
  const assigned = tasksAssignedBy(actor.id)
    .filter((t) => {
      if (t.status === "done") return false;
      const assignee = roster.find((e) => e.id === t.assigneeId);
      if (assignee && assignee.role.toLowerCase().includes("admin")) return false;
      return true;
    })
    .slice(0, 3);
  for (const t of assigned) {
    items.push({
      id: `as-${t.id}`,
      weight: 40,
      kicker: "You assigned · in flight",
      title: t.title,
      body: `Owner: ${roster.find((e) => e.id === t.assigneeId)?.name ?? "—"}`,
      to: "/tasks",
      tone: "info",
    });
  }

  // --- EOD Pulse Parsing ---
  // check only daily pulses of employee, hr not admin and read Eod read it and make priority based on that
  if (actor.appRole !== "admin" && actor.appRole !== "hr" && actor.appRole !== "manager") {
    const todayISOStr = todayISO();
    const myEodPulse = getEntries({ employeeId: actor.id, date: todayISOStr, slot: "eod" })[0];
    
    // If we have an EOD pulse, and the user mentioned blockers or closures, highlight them
    if (myEodPulse) {
      if (myEodPulse.blockers && myEodPulse.blockers.length > 0) {
        items.push({
          id: `eod-block-${myEodPulse.id}`,
          weight: 65,
          kicker: "EOD Blocker",
          title: "Follow up on your EOD Blocker",
          body: myEodPulse.blockers,
          to: "/pulse",
          tone: "warn",
        });
      } else if (myEodPulse.closures && myEodPulse.closures > 0) {
        items.push({
          id: `eod-win-${myEodPulse.id}`,
          weight: 35,
          kicker: "EOD Summary",
          title: `You had ${myEodPulse.closures} closures! Keep the momentum.`,
          body: myEodPulse.text,
          to: "/pulse",
          tone: "neutral",
        });
      } else {
        items.push({
          id: `eod-gen-${myEodPulse.id}`,
          weight: 30,
          kicker: "EOD Logged",
          title: "Review your EOD pulse",
          body: myEodPulse.text,
          to: "/pulse",
          tone: "neutral",
        });
      }
    } else {
      // If no EOD pulse, but it's late in the day (after 8:00 PM / 20:00), prompt them to log it.
      const d = new Date();
      const m = d.getHours() * 60 + d.getMinutes();
      if (m >= 20 * 60) {
        items.push({
          id: `eod-missing-${Date.now()}`,
          weight: 55,
          kicker: "Missing EOD",
          title: "Log your End of Day Pulse",
          body: "What did you close today? Any pending items or blockers?",
          to: "/pulse",
          tone: "warn",
        });
      }
    }
  }

  // Sort by weight desc, cap to 5
  items.sort((a, b) => b.weight - a.weight);
  return items.slice(0, 5);
}

export const TIER_MISSION_LABEL: Record<Tier, string> = {
  leadership: "Command brief",
  zone_leader: "Zone brief",
  hr: "People brief",
  leader: "Pod brief",
  recruiter: "Funnel brief",
  teammate: "Today's brief",
  partner: "Property brief",
};
