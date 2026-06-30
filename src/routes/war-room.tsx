import { createFileRoute, Link } from "@tanstack/react-router";
import type { Tier } from "@/types/hr";
import { teamSummary, tierFor } from "@/lib/team-metrics";
import { computeScore } from "@/lib/score-engine";
import { useRosterState } from "@/hooks/useRoster";
import { Loader2 } from "lucide-react";
import { ArrowDown, ArrowUp, Flame, Target, IndianRupee, Phone, AlertTriangle } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/war-room")({
  component: () => (
    <RoleGate allow={["leadership", "zone_leader", "leader"]}>
      <WarRoom />
    </RoleGate>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

const tierColor: Record<Tier, string> = {
  A: "bg-success/10 text-success border-success/20",
  B: "bg-info/10 text-info border-info/20",
  C: "bg-warning/15 text-warning border-warning/30",
  D: "bg-destructive/10 text-destructive border-destructive/20",
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 md:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accent ?? "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 font-display text-2xl md:text-3xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ScoreBar({ value, color = "bg-primary" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function WarRoom() {
  const { roster, loading } = useRosterState();
  const s = teamSummary(roster);
  const sorted = [...roster].sort((a, b) => b.performance - a.performance);
  const inr = (n: number) =>
    "₹" + (n >= 100000 ? (n / 100000).toFixed(1) + "L" : n.toLocaleString("en-IN"));

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  usePageTour("war_room_tour", [
    {
      element: "#tour-warroom-stats",
      popover: { title: "Executive Snapshot", description: "High-level metrics for today, including revenue, active leads, and team composition.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-warroom-performers",
      popover: { title: "Top & Bottom Performers", description: "Quickly identify who is crushing it and who might need a performance review.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-warroom-leaderboard",
      popover: { title: "Live Leaderboard", description: "Detailed ranking of the entire workforce based on attendance, task completion, and role-specific KPIs.", side: "top", align: "start" }
    },
    {
      element: "#tour-warroom-myscore",
      popover: { title: "Personal Score", description: "Click here to view your own personal scorecard and performance breakdown.", side: "left", align: "start" }
    }
  ]);

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
      <header className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
          Daily War Room
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">
          Today's execution snapshot
        </h1>
        <p className="text-muted-foreground text-sm mt-1">No hiding. No confusion.</p>
      </header>

      <section id="tour-warroom-stats" className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard
          label="Revenue"
          value={inr(s.totalRevenue)}
          sub={`${s.totalDeals} deals`}
          icon={IndianRupee}
          accent="text-primary"
        />
        <StatCard label="Calls" value={String(s.totalCalls)} icon={Phone} accent="text-info" />
        <StatCard
          label="Active leads"
          value={String(s.totalLeads)}
          icon={Target}
          accent="text-warning"
        />
        <StatCard
          label="A-players"
          value={String(s.counts.A)}
          sub={`B:${s.counts.B} C:${s.counts.C} D:${s.counts.D}`}
          icon={Flame}
          accent="text-success"
        />
      </section>

      <section id="tour-warroom-performers" className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
        <div className="rounded-xl bg-card border border-border p-4 md:p-5">
          <div className="flex items-center gap-2 text-success mb-2">
            <ArrowUp className="h-4 w-4" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Top Performer</span>
          </div>
          <div className="font-display text-lg font-semibold">{s.top?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground mb-3">{s.top?.role ?? ""}</div>
          {s.top && <ScoreBar value={s.top.performance} color="bg-success" />}
        </div>
        <div className="rounded-xl bg-card border border-border p-4 md:p-5">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <ArrowDown className="h-4 w-4" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Replace Signal</span>
          </div>
          <div className="font-display text-lg font-semibold">{s.bottom?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground mb-3">
            {s.bottom ? `${s.bottom.role} · ${(s.bottom.flags ?? []).length} flags` : ""}
          </div>
          {s.bottom && <ScoreBar value={s.bottom.performance} color="bg-destructive" />}
        </div>
      </section>

      <section id="tour-warroom-leaderboard" className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-base md:text-lg font-semibold">Live Leaderboard</h2>
          <Link id="tour-warroom-myscore" to="/score" className="text-xs text-primary hover:underline">
            My score →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 md:px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Rank</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Employee</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Attendance</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tasks</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Role KPI</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Score</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tier</th>
                <th className="px-4 md:px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-right">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((e, i) => {
                const t = tierFor(e.performance);
                const score = computeScore(e);
                return (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 md:px-5 py-3 w-12 font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="font-medium text-sm truncate">{e.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {e.role} · {e.team}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{score.attendance}%</td>
                    <td className="px-4 py-3 font-mono text-xs">{score.taskOnTime}%</td>
                    <td className="px-4 py-3 font-mono text-xs">{score.roleKpi}%</td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-primary">{score.total}</td>
                    <td className="px-4 py-3 w-16">
                      <span
                        className={`inline-flex items-center justify-center h-6 w-6 rounded border font-mono font-semibold text-[11px] ${tierColor[t]}`}
                      >
                        {t}
                      </span>
                    </td>
                    <td className="px-4 md:px-5 py-3 text-right">
                      {(e.flags ?? []).length > 0 ? (
                        <span className="inline-flex justify-end items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {(e.flags ?? []).length}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
