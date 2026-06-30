import type { Employee } from "@/types/hr";
import { tierFor } from "@/lib/team-metrics";
import { getRoster } from "@/lib/roster";
import { tasksFor } from "./task-store";
import { kudosReceived } from "./kudos-store";

export interface ScoreBreakdown {
  attendance: number; // 0-100
  taskOnTime: number; // 0-100
  kudos: number; // 0-100 (capped count)
  roleKpi: number; // 0-100
  total: number; // weighted
}

const D = 24 * 60 * 60 * 1000;

export function computeScore(emp: Employee): ScoreBreakdown {
  const att = emp.attendance;
  const tasks = tasksFor(emp.id);
  const completed = tasks.filter((t) => t.status === "done");
  const taskCompletionPct =
    tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : emp.taskCompletion;

  const kudos = 0; // Removed from total score calculation
  const roleKpi = 0; // Removed from total score calculation

  // Score based ONLY on Attendance and Task Completion, weighted equally (50/50)
  const total = Math.round((att + taskCompletionPct) / 2);
  return { attendance: att, taskOnTime: taskCompletionPct, kudos, roleKpi, total };
}

export function squadOf(emp: Employee): Employee[] {
  // Same team OR people they manage / manager
  return getRoster().filter(
    (e) =>
      e.id !== emp.id && (e.team === emp.team || e.managerId === emp.id || e.id === emp.managerId),
  );
}

export function rankInSquad(emp: Employee): { rank: number; total: number } {
  const squad = [emp, ...squadOf(emp)];
  const ranked = squad
    .map((e) => ({ id: e.id, score: computeScore(e).total }))
    .sort((a, b) => b.score - a.score);
  const idx = ranked.findIndex((r) => r.id === emp.id);
  return { rank: idx + 1, total: ranked.length };
}

export function tierOf(emp: Employee) {
  return tierFor(computeScore(emp).total);
}

export function trendData(emp: Employee, weeks = 8): number[] {
  // Deterministic synthetic trend so it looks alive but stable per-employee
  const base = computeScore(emp).total;
  const seed = emp.id.charCodeAt(emp.id.length - 1);
  const out: number[] = [];
  for (let i = 0; i < weeks; i++) {
    const swing = ((seed * (i + 3)) % 11) - 5;
    out.push(Math.max(20, Math.min(100, base - 8 + i + swing)));
  }
  return out;
}
