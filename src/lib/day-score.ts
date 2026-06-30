// Per-day breakdown for the /score drill-down. Builds 14 days of synthetic-but-stable
// daily scores so the UI feels alive without requiring full event history.
import type { Employee } from "@/types/hr";
import { getEventsFor, dateKey } from "./attendance-store";
import { tasksFor } from "./task-store";
import { kudosReceived } from "./kudos-store";

export interface DayScore {
  dayKey: string;
  label: string;
  attendance: number;
  performance: number;
  consistency: number;
  conversion: number; // output→win conversion %
  output: number; // raw activity output (calls/tours/tasks)
  total: number;
  events: number;
  tasksDone: number;
  kudos: number;
}

const D = 24 * 60 * 60 * 1000;

function seededDelta(seed: string, day: number, max: number) {
  let h = day * 17;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % max;
}

export function lastNDays(emp: Employee, n = 14): DayScore[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: DayScore[] = [];
  const allTasks = tasksFor(emp.id);
  const allKudos = kudosReceived(emp.id);

  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(today.getTime() - i * D);
    const key = dateKey(dt.getTime());
    const dayStart = dt.getTime();
    const dayEnd = dayStart + D;

    const events = getEventsFor(emp.id, key);
    const tasksDone = allTasks.filter(
      (t) =>
        t.status === "done" && (t.completedAt ?? 0) >= dayStart && (t.completedAt ?? 0) < dayEnd,
    ).length;
    const kudos = allKudos.filter((k) => k.ts >= dayStart && k.ts < dayEnd).length;

    const baseAtt = emp.attendance;
    const basePerf = emp.performance;
    const baseCons = emp.consistency;
    const wobble = seededDelta(emp.id + key, i, 12) - 6;

    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    const attendance =
      events.length > 0
        ? Math.max(0, Math.min(100, baseAtt + wobble))
        : isWeekend
          ? Math.max(0, Math.min(100, baseAtt - 4 + wobble))
          : Math.max(0, Math.min(100, baseAtt - 18 + wobble));

    const performance = Math.max(0, Math.min(100, basePerf + wobble + tasksDone * 4));
    const consistency = Math.max(0, Math.min(100, baseCons + Math.round(wobble / 2)));

    // Output: role-aware activity volume (calls/tours/tasks) on this day.
    const outputBase =
      emp.role === "Operator"
        ? Math.round((emp.callsToday / Math.max(1, emp.callTarget)) * 100)
        : emp.role === "TCM"
          ? emp.taskCompletion
          : emp.performance;
    const output = Math.max(
      0,
      Math.min(100, outputBase + wobble + tasksDone * 3 - (isWeekend ? 15 : 0)),
    );

    // Conversion: how much of that output translated into wins (deterministic but lively).
    const convBase = Math.round((emp.conversion ?? 18) * 2.6); // ~0–80 baseline
    const conversion = Math.max(
      0,
      Math.min(
        100,
        convBase + Math.round(wobble * 0.8) + (tasksDone > 0 ? 6 : -3) - (isWeekend ? 8 : 0),
      ),
    );

    const total = Math.round(
      attendance * 0.35 +
        performance * 0.25 +
        conversion * 0.15 +
        consistency * 0.15 +
        Math.min(100, kudos * 25) * 0.1,
    );

    out.push({
      dayKey: key,
      label: dt.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" }),
      attendance,
      performance,
      consistency,
      conversion,
      output,
      total,
      events: events.length,
      tasksDone,
      kudos,
    });
  }
  return out;
}
