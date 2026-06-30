import type { Employee, Tier } from "@/types/hr";
import { getRoster } from "@/lib/roster";

export function tierFor(perf: number): Tier {
  if (perf >= 85) return "A";
  if (perf >= 70) return "B";
  if (perf >= 55) return "C";
  return "D";
}

export function teamSummary(roster: Employee[] = getRoster()) {
  if (!roster.length) {
    return {
      totalRevenue: 0,
      totalCalls: 0,
      totalCallTarget: 0,
      totalDeals: 0,
      totalLeads: 0,
      top: undefined as Employee | undefined,
      bottom: undefined as Employee | undefined,
      counts: { A: 0, B: 0, C: 0, D: 0 },
    };
  }
  const totalRevenue = roster.reduce((s, e) => s + e.revenueImpact, 0);
  const totalCalls = roster.reduce((s, e) => s + e.callsToday, 0);
  const totalCallTarget = roster.reduce((s, e) => s + (e.callTarget || 0), 0);
  const totalDeals = roster.reduce((s, e) => s + e.closedDeals, 0);
  const totalLeads = roster.reduce((s, e) => s + e.leadsActive, 0);
  const sorted = [...roster].sort((a, b) => b.performance - a.performance);
  return {
    totalRevenue,
    totalCalls,
    totalCallTarget,
    totalDeals,
    totalLeads,
    top: sorted[0],
    bottom: sorted.length > 1 && sorted[sorted.length - 1].id !== sorted[0].id ? sorted[sorted.length - 1] : undefined,
    counts: {
      A: roster.filter((e) => tierFor(e.performance) === "A").length,
      B: roster.filter((e) => tierFor(e.performance) === "B").length,
      C: roster.filter((e) => tierFor(e.performance) === "C").length,
      D: roster.filter((e) => tierFor(e.performance) === "D").length,
    },
  };
}
