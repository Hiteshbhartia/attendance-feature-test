import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { Tier } from "@/types/hr";
import { teamSummary, tierFor } from "@/lib/team-metrics";
import { getRoster } from "@/lib/roster";
import { computeScore, rankInSquad, squadOf } from "@/lib/score-engine";
import { lastNDays, type DayScore } from "@/lib/day-score";
import { useAttendanceState } from "@/hooks/useAttendance";
import { Avatar } from "@/components/Avatar";
import {
  Trophy,
  Flame,
  Activity,
  ShieldCheck,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { useRoleFeature } from "@/hooks/useRoleFeature";

export const Route = createFileRoute("/score")({
  component: ScorePage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Score view error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

const tierColor: Record<Tier, string> = {
  A: "bg-success/15 text-success border-success/30",
  B: "bg-info/15 text-info border-info/30",
  C: "bg-warning/15 text-warning border-warning/30",
  D: "bg-destructive/15 text-destructive border-destructive/30",
};

function Bar({ value, color = "bg-primary" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className="font-display text-3xl font-semibold leading-none">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function trendIcon(prev: number, curr: number) {
  if (curr > prev + 2) return <ArrowUp className="h-3 w-3 text-success" />;
  if (curr < prev - 2) return <ArrowDown className="h-3 w-3 text-destructive" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function ScorePage() {
  const { actor } = useAttendanceState();
  const [selectedId, setSelectedId] = useState(actor.id);
  const emp = getRoster().find((e) => e.id === selectedId) ?? actor;
  const hasFeature = useRoleFeature();

  const score = computeScore(emp);
  const rank = rankInSquad(emp);
  const tier = tierFor(score.total);
  const squad = [emp, ...squadOf(emp)]
    .map((e) => ({ e, s: computeScore(e).total }))
    .sort((a, b) => b.s - a.s);

  const days: DayScore[] = lastNDays(emp, 14);
  const [openDay, setOpenDay] = useState<string | null>(days[days.length - 1]?.dayKey ?? null);

  const week = days.slice(-7);
  const prevWeek = days.slice(-14, -7);
  const weekAvg = Math.round(week.reduce((s, d) => s + d.total, 0) / Math.max(1, week.length));
  const prevWeekAvg = Math.round(
    prevWeek.reduce((s, d) => s + d.total, 0) / Math.max(1, prevWeek.length),
  );

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1200px] mx-auto">
      <header className="mb-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-4 transition-colors">
          &larr; Back to Dashboard
        </Link>
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
          Performance Scorecard
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">
          Where you stand. Where you climb.
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Attendance, performance and consistency — drilled by day.
        </p>
      </header>

      <div className="rounded-2xl bg-sidebar text-sidebar-foreground p-4 md:p-6 mb-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        <div className="flex items-center gap-3">
          <Avatar id={emp.id} size={56} />
          <div className="min-w-0">
            <div className="font-display text-lg md:text-xl font-semibold text-white truncate">
              {emp.name}
            </div>
            <div className="text-xs font-mono uppercase tracking-widest text-sidebar-foreground/70">
              {emp.role} · {emp.team}
            </div>
          </div>
          <span
            className={`ml-auto md:ml-3 inline-flex items-center justify-center h-9 w-9 rounded-md border font-mono font-semibold text-sm ${tierColor[tier]}`}
          >
            {tier}
          </span>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-sidebar-foreground/60">
              Total
            </div>
            <div className="font-display text-3xl text-white font-semibold leading-none mt-1">
              {score.total}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-sidebar-foreground/60">
              Rank
            </div>
            <div className="font-display text-3xl text-white font-semibold leading-none mt-1">
              #{rank.rank}
              <span className="text-sm text-sidebar-foreground/60 font-mono">/{rank.total}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-sidebar-foreground/60">
              7-day Δ
            </div>
            <div className="font-display text-3xl text-white font-semibold leading-none mt-1 flex items-center gap-1">
              {weekAvg - prevWeekAvg >= 0 ? "+" : ""}
              {weekAvg - prevWeekAvg}
              {trendIcon(prevWeekAvg, weekAvg)}
            </div>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard
          label="Attendance"
          value={score.attendance}
          sub="Showing up"
          icon={ShieldCheck}
          accent="text-success"
        />
        <StatCard
          label="Performance"
          value={score.roleKpi}
          sub="Role KPI"
          icon={Trophy}
          accent="text-primary"
        />
        <StatCard
          label="Consistency"
          value={emp.consistency}
          sub="Hold the line"
          icon={Activity}
          accent="text-info"
        />
        <StatCard
          label="Streak"
          value={`${emp.streakDays}d`}
          sub="Don't break"
          icon={Flame}
          accent="text-warning"
        />
      </section>

      <section className="rounded-2xl bg-card border border-border overflow-hidden mb-6">
        <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-base md:text-lg font-semibold">Last 14 days</h2>
            <p className="text-xs text-muted-foreground">
              Click any date to see attendance, output, conversion, and consistency for that day.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Avg {weekAvg}
          </span>
        </div>

        {/* Sparkline-ish bar strip */}
        <div className="px-3 md:px-5 pt-4 pb-2 flex items-end gap-1 md:gap-1.5 h-28">
          {days.map((d) => {
            const active = openDay === d.dayKey;
            const t = tierFor(d.total);
            const color =
              t === "A"
                ? "bg-success"
                : t === "B"
                  ? "bg-info"
                  : t === "C"
                    ? "bg-warning"
                    : "bg-destructive";
            return (
              <button
                key={d.dayKey}
                onClick={() => setOpenDay(d.dayKey)}
                className={`flex-1 min-w-[8px] rounded-t-sm transition-all ${color} ${active ? "ring-2 ring-primary/60 opacity-100" : "opacity-70 hover:opacity-100"}`}
                style={{ height: `${Math.max(8, d.total)}%` }}
                title={`${d.label}: ${d.total}`}
              />
            );
          })}
        </div>
        <div className="px-3 md:px-5 pb-3 flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>{days[0].label}</span>
          <span>{days[days.length - 1].label}</span>
        </div>

        <div className="border-t border-border divide-y divide-border">
          {days
            .slice()
            .reverse()
            .map((d) => {
              const active = openDay === d.dayKey;
              const t = tierFor(d.total);
              return (
                <div key={d.dayKey}>
                  <button
                    onClick={() => setOpenDay(active ? null : d.dayKey)}
                    aria-expanded={active}
                    className="w-full px-4 md:px-5 py-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className="w-20 md:w-28 shrink-0">
                      <div className="font-medium text-sm">{d.label}</div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        {d.events} events · {d.tasksDone} done
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Bar
                        value={d.total}
                        color={
                          t === "A"
                            ? "bg-success"
                            : t === "B"
                              ? "bg-info"
                              : t === "C"
                                ? "bg-warning"
                                : "bg-destructive"
                        }
                      />
                    </div>
                    <div className="w-12 text-right font-mono text-sm font-semibold">{d.total}</div>
                    <span
                      className={`hidden md:inline-flex items-center justify-center h-6 w-6 rounded border font-mono font-semibold text-[11px] ${tierColor[t]}`}
                    >
                      {t}
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${active ? "rotate-90" : ""}`}
                    />
                  </button>
                  {active && (
                    <div className="px-4 md:px-5 py-4 bg-secondary/30 border-t border-border space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display text-base font-semibold">{d.label}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Tier <span className="font-mono">{t}</span> · Score{" "}
                            <span className="font-mono">{d.total}</span>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center justify-center h-7 px-2 rounded border font-mono font-semibold text-[11px] ${tierColor[t]}`}
                        >
                          {t} · {d.total}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <DrillCell label="Attendance" value={d.attendance} weight="35%" />
                        <DrillCell label="Output" value={d.output} weight="activity" />
                        <DrillCell
                          label="Conversion"
                          value={d.conversion}
                          weight="15%"
                          suffix="%"
                        />
                        <DrillCell label="Consistency" value={d.consistency} weight="15%" />
                        <DrillCell label="Tasks done" value={d.tasksDone} weight="logged" raw />
                      </div>
                      <div className="text-[11px] text-muted-foreground bg-card border border-border rounded-md px-3 py-2">
                        {d.events === 0
                          ? "No clock-in recorded — attendance hit. Mark on /attendance to recover."
                          : d.tasksDone === 0
                            ? "Showed up, but zero tasks closed. Convert one to-do before EOD to lift the day."
                            : `Solid day — ${d.tasksDone} task${d.tasksDone === 1 ? "" : "s"} closed${d.kudos ? ` and ${d.kudos} kudo${d.kudos === 1 ? "" : "s"} received` : ""}.`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      <section className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-base md:text-lg font-semibold">Squad ranking</h2>
            <p className="text-xs text-muted-foreground">
              {emp.team} · {squad.length} people
            </p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {squad.map((row, i) => {
            const t = tierFor(row.s);
            const me = row.e.id === emp.id;
            return (
              <button
                key={row.e.id}
                onClick={() => setSelectedId(row.e.id)}
                className={`w-full px-4 md:px-5 py-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left ${me ? "bg-primary/5" : ""}`}
              >
                <div className="w-6 font-mono text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <Avatar id={row.e.id} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {row.e.name}{" "}
                    {me && <span className="text-[10px] text-primary font-mono ml-1">YOU</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{row.e.role}</div>
                </div>
                <span
                  className={`inline-flex items-center justify-center h-6 w-6 rounded border font-mono font-semibold text-[11px] ${tierColor[t]}`}
                >
                  {t}
                </span>
                <div className="w-10 text-right font-mono text-sm font-semibold">{row.s}</div>
              </button>
            );
          })}
        </div>
        {hasFeature("/achievements") && (
          <div className="px-4 md:px-5 py-3 border-t border-border">
            <Link to="/achievements" className="text-xs text-primary hover:underline">
              Unlock badges from this score →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function DrillCell({
  label,
  value,
  suffix = "",
  raw = false,
  weight,
}: {
  label: string;
  value: number;
  suffix?: string;
  raw?: boolean;
  weight?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        {weight && <div className="text-[9px] font-mono text-muted-foreground/70">{weight}</div>}
      </div>
      <div className="font-display text-xl font-semibold mt-1">
        {value}
        {suffix}
      </div>
      {!raw && (
        <div className="mt-1.5">
          <Bar
            value={value}
            color={
              value >= 85
                ? "bg-success"
                : value >= 70
                  ? "bg-info"
                  : value >= 55
                    ? "bg-warning"
                    : "bg-destructive"
            }
          />
        </div>
      )}
    </div>
  );
}
