import { createFileRoute } from "@tanstack/react-router";
import type { Tier } from "@/types/hr";
import { tierFor } from "@/lib/team-metrics";
import { useRosterState } from "@/hooks/useRoster";
import { AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/team")({
  component: TeamPage,
  head: () => ({ meta: [{ title: "Team — Gharpayy Core AI" }] }),
});

const tierColor: Record<Tier, string> = {
  A: "bg-success/10 text-success border-success/20",
  B: "bg-info/10 text-info border-info/20",
  C: "bg-warning/15 text-warning border-warning/30",
  D: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusColor: Record<string, string> = {
  Active: "bg-success",
  Idle: "bg-warning",
  Late: "bg-destructive",
  Offline: "bg-muted-foreground",
};

function TeamPage() {
  const { roster, loading, isEmpty } = useRosterState();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px]">
      <header className="mb-8">
        <div className="font-mono text-xs uppercase tracking-widest text-primary mb-2">Roster</div>
        <h1 className="font-display text-4xl font-semibold">Digital identity per employee</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Live profiles. Every score updates in real time.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        {isEmpty && (
          <p className="text-sm text-muted-foreground col-span-3">No employees loaded yet.</p>
        )}
        {roster.map((e) => {
          const t = tierFor(e.performance);
          return (
            <div key={e.id} className="rounded-xl bg-card border border-border p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${statusColor[e.status]}`} />
                    <span className="font-display text-lg font-semibold">{e.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {e.role} · {e.experience} · {e.status}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center justify-center h-8 w-8 rounded-md border font-mono font-semibold text-sm ${tierColor[t]}`}
                >
                  {t}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 font-mono text-xs">
                <div>
                  <div className="text-muted-foreground uppercase tracking-wider text-[10px]">
                    Att
                  </div>
                  <div className="text-base font-semibold">{e.attendance}</div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase tracking-wider text-[10px]">
                    Perf
                  </div>
                  <div className="text-base font-semibold">{e.performance}</div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase tracking-wider text-[10px]">
                    Cons
                  </div>
                  <div className="text-base font-semibold">{e.consistency}</div>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground border-t border-border pt-3">
                <div className="flex justify-between">
                  <span>Tasks</span>
                  <span className="font-mono text-foreground">{e.taskCompletion}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Conversion</span>
                  <span className="font-mono text-foreground">{e.conversion}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Streak</span>
                  <span className="font-mono text-foreground">{e.streakDays}d</span>
                </div>
              </div>

              {(e.flags ?? []).length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1 text-xs text-destructive mb-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="font-mono uppercase tracking-wider text-[10px]">
                      Behavior Flags
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(e.flags ?? []).map((f) => (
                      <span
                        key={f}
                        className="text-[10px] px-2 py-0.5 rounded bg-destructive/10 text-destructive"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
