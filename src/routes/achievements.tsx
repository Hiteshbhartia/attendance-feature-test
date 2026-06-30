import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type Employee } from "@/types/hr";
import { getRoster } from "@/lib/roster";
import {
  achievementsFor,
  earnedCount,
  leaderboardByEarned,
  levelClasses,
  topGrowthAreas,
  type Achievement,
} from "@/lib/achievements";
import { Avatar } from "@/components/Avatar";
import { useAttendanceState } from "@/hooks/useAttendance";
import { Trophy, Lock } from "lucide-react";

export const Route = createFileRoute("/achievements")({
  component: AchievementsPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Achievements error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

function AchievementsPage() {
  const { actor } = useAttendanceState();
  const [selectedId, setSelectedId] = useState(actor.id);
  const emp = getRoster().find((e) => e.id === selectedId) ?? actor;

  const list = useMemo(() => achievementsFor(emp), [emp]);
  const earned = list.filter((a) => a.earned);
  const locked = list.filter((a) => !a.earned).sort((a, b) => b.progress - a.progress);
  const board = useMemo(() => leaderboardByEarned(), []);
  const growth = topGrowthAreas(emp);

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
      <header className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
          Recognition & Growth
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">
          Earn what you build.
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Badges unlock as your scores climb. Progress, never participation.
        </p>
      </header>

      <section className="rounded-2xl bg-sidebar text-sidebar-foreground p-4 md:p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div className="flex items-center gap-3">
          <Avatar id={emp.id} size={56} />
          <div className="min-w-0">
            <div className="font-display text-lg md:text-xl font-semibold text-white truncate">
              {emp.name}
            </div>
            <div className="text-xs font-mono uppercase tracking-widest text-sidebar-foreground/70">
              {emp.role}
            </div>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-sidebar-foreground/60">
            Badges earned
          </div>
          <div className="font-display text-3xl text-white font-semibold leading-none mt-1">
            {earned.length}
            <span className="text-sm text-sidebar-foreground/60 font-mono">/{list.length}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-sidebar-foreground/60 mb-1.5">
            Closest gap
          </div>
          {growth[0] && (
            <div>
              <div className="text-sm text-white font-medium">{growth[0].label}</div>
              <div className="h-1.5 mt-1 w-full bg-sidebar-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, (growth[0].value / growth[0].target) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-sidebar-foreground/70 mt-1">
                {growth[0].value} / {growth[0].target} target
              </div>
            </div>
          )}
        </div>
      </section>

      {earned.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-lg font-semibold mb-3">Earned</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {earned.map((a) => (
              <BadgeCard key={a.id} a={a} earned />
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="font-display text-lg font-semibold mb-3">Within reach</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {locked.map((a) => (
            <BadgeCard key={a.id} a={a} earned={false} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-base md:text-lg font-semibold">
              Recognition leaderboard
            </h2>
            <p className="text-xs text-muted-foreground">
              Most badges + highest score wins the week.
            </p>
          </div>
          <Link to="/score" className="text-xs text-primary hover:underline hidden sm:inline">
            Open scorecard →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {board.map((row, i) => {
            const me = row.emp.id === emp.id;
            return (
              <button
                key={row.emp.id}
                onClick={() => setSelectedId(row.emp.id)}
                className={`w-full px-4 md:px-5 py-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left ${me ? "bg-primary/5" : ""}`}
              >
                <div className="w-7 font-mono text-sm font-semibold text-muted-foreground">
                  {i === 0
                    ? "🥇"
                    : i === 1
                      ? "🥈"
                      : i === 2
                        ? "🥉"
                        : String(i + 1).padStart(2, "0")}
                </div>
                <Avatar id={row.emp.id} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {row.emp.name}
                    {me && <span className="text-[10px] text-primary font-mono ml-1">YOU</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {row.emp.role} · {row.emp.team}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Trophy className="h-3.5 w-3.5 text-warning" />
                  <span className="font-mono font-semibold">{row.earned}</span>
                </div>
                <div className="w-12 text-right font-mono text-sm font-semibold">{row.score}</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BadgeCard({ a, earned }: { a: Achievement; earned: boolean }) {
  const Icon = a.icon;
  const ring = levelClasses(a.level);
  return (
    <div
      className={`rounded-2xl border p-3 md:p-4 transition-all ${earned ? "bg-card border-border" : "bg-secondary/40 border-dashed border-border"}`}
    >
      <div className="relative mx-auto h-14 w-14 md:h-16 md:w-16 mb-3">
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-br ${ring} ${earned ? "" : "opacity-30 grayscale"}`}
        />
        <div className="absolute inset-1 rounded-full bg-card flex items-center justify-center">
          {earned ? (
            <Icon className="h-6 w-6 md:h-7 md:w-7 text-foreground" />
          ) : (
            <Lock className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>
      <div className="text-center">
        <div className="font-display text-sm font-semibold leading-tight">{a.title}</div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
          {a.level}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-2 leading-snug line-clamp-2">
        {a.description}
      </p>
      {!earned && (
        <div className="mt-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${a.progress}%` }} />
          </div>
          <div className="text-[10px] font-mono text-muted-foreground text-center mt-1">
            {a.progress}%
          </div>
        </div>
      )}
    </div>
  );
}
