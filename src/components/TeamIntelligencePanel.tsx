/**
 * TeamIntelligencePanel — Team Intelligence layer inside the Operator Console.
 * Shown only to leadership | hr | leader | zone_leader tiers.
 * Null-safe throughout: no unsafe .length/.map/.filter on potentially undefined values.
 */
import { useState } from "react";
import {
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Flame,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Brain,
  Activity,
  Zap,
} from "lucide-react";
import type { Employee } from "@/types/hr";
import { tierOf } from "@/lib/permissions";
import {
  useTeamIntelligence,
  useMemberIntelligence,
} from "@/lib/team-intelligence-api";
import type { MemberMetrics } from "@/types/team";
import { Avatar } from "@/components/Avatar";

const MANAGER_TIERS = new Set(["leadership", "hr", "leader", "zone_leader"]);

// ─── Entry gate — employees see nothing ──────────────────────────────────────
export function TeamIntelligencePanel({ actor }: { actor: Employee }) {
  const tier = tierOf(actor);
  if (!MANAGER_TIERS.has(tier)) return null;
  return <TeamIntelligenceContent />;
}

// ─── Main content ─────────────────────────────────────────────────────────────
function TeamIntelligenceContent() {
  const { data, loading, error, refresh } = useTeamIntelligence();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "members" | "comparison" | "governance">(
    "overview",
  );

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-card to-secondary/20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Operator Console
            </div>
            <h2 className="font-display text-base font-semibold">Team Intelligence</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.generatedAt > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {data.period.daysBack}d window
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border hover:bg-secondary transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-3 bg-destructive/10 border-b border-destructive/20 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data.ok && (
        <div className="px-5 py-8 flex items-center justify-center text-muted-foreground gap-2">
          <Activity className="h-5 w-5 animate-pulse text-primary" />
          <span className="text-sm">Loading team analytics…</span>
        </div>
      )}

      {/* No data yet */}
      {!loading && !data.ok && !error && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          Click refresh to load team intelligence for the last 30 days.
        </div>
      )}

      {data.ok && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-border">
            {(["overview", "members", "comparison", "governance"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest transition ${
                  activeTab === tab
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-5">
            {activeTab === "overview" && <OverviewTab data={data} />}
            {activeTab === "members" && (
              <MembersTab
                members={data.members}
                expandedId={expandedId}
                onExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              />
            )}
            {activeTab === "comparison" && <ComparisonTab comparison={data.teamComparison} />}
            {activeTab === "governance" && (
              <GovernanceTab definitions={data.kpiDefinitions} targets={data.kpiTargets} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ data }: { data: ReturnType<typeof useTeamIntelligence>["data"] }) {
  const { health, topPerformers, interventionNeeded, orgInsights } = data;

  const statCards = [
    { label: "Team Size", value: health.total, icon: Users, color: "text-primary" },
    { label: "Present", value: health.present, icon: Activity, color: "text-success" },
    { label: "Late Today", value: health.late, icon: Clock, color: "text-warning" },
    { label: "Absent", value: health.absent, icon: TrendingDown, color: "text-destructive" },
    { label: "Leave Risk", value: health.leaveRisk, icon: AlertTriangle, color: "text-warning" },
    { label: "Burnout High", value: health.burnoutHigh, icon: Flame, color: "text-destructive" },
  ];

  const scoreCards = [
    { label: "Avg Engagement", value: health.avgEngagement, color: "text-primary" },
    { label: "Avg Completion", value: health.avgCompletion, color: "text-info" },
    { label: "Avg Presence", value: health.avgPresence, color: "text-success" },
  ];

  return (
    <div className="space-y-5">
      {/* Stat grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
            <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
            <div className="font-display text-xl font-bold">{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-3 gap-3">
        {scoreCards.map((sc) => (
          <div key={sc.label} className="rounded-lg border border-border bg-card p-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
              {sc.label}
            </div>
            <div className={`text-2xl font-bold tabular-nums ${sc.color}`}>{sc.value}%</div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full bg-current ${sc.color} opacity-60`}
                style={{ width: `${Math.min(100, sc.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Org insights */}
      {orgInsights.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Operational Insights
            </span>
          </div>
          <ul className="space-y-2">
            {orgInsights.map((insight, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top performers */}
      {topPerformers.length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Top Performers
          </div>
          <div className="space-y-2">
            {topPerformers.map((p, i) => (
              <div
                key={p.employeeId}
                className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 px-3 py-2"
              >
                <div className="font-mono text-xs text-muted-foreground w-5">{i + 1}</div>
                <Avatar id={p.employeeId} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{p.role}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-success">{p.performance}</div>
                  <div className="text-[10px] text-muted-foreground">{p.completionRate}% tasks</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intervention needed */}
      {interventionNeeded.length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-destructive mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Needs Intervention
          </div>
          <div className="space-y-2">
            {interventionNeeded.map((m) => (
              <div
                key={m.employeeId}
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Avatar id={m.employeeId} size={24} />
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="ml-auto text-[10px] font-mono uppercase text-destructive">
                    {m.burnoutRisk} risk
                  </span>
                </div>
                {m.insights.slice(0, 2).map((ins: string, i: number) => (
                  <div key={i} className="text-xs text-muted-foreground pl-7">
                    {ins}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Members tab ──────────────────────────────────────────────────────────────
function MembersTab({
  members,
  expandedId,
  onExpand,
}: {
  members: MemberMetrics[];
  expandedId: string | null;
  onExpand: (id: string) => void;
}) {
  if (members.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No team members in your hierarchy.
      </div>
    );
  }

  const burnoutColor: Record<string, string> = {
    none: "text-success",
    low: "text-info",
    medium: "text-warning",
    high: "text-destructive",
  };

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.employeeId} className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => onExpand(m.employeeId)}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-secondary/30 transition"
          >
            <Avatar id={m.employeeId} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {m.role} · {m.team}
              </div>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <div className="text-xs font-bold">{m.tasks.completionRate}%</div>
                <div className="text-[9px] text-muted-foreground">tasks</div>
              </div>
              <div>
                <div className="text-xs font-bold">{m.presence}%</div>
                <div className="text-[9px] text-muted-foreground">presence</div>
              </div>
              <div
                className={`text-[10px] font-mono uppercase ${burnoutColor[m.burnoutRisk] ?? "text-muted-foreground"}`}
              >
                {m.burnoutRisk}
              </div>
              {expandedId === m.employeeId ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          </button>

          {expandedId === m.employeeId && <MemberDeepDive member={m} />}
        </div>
      ))}
    </div>
  );
}

function MemberDeepDive({ member }: { member: MemberMetrics }) {
  const { data, loading } = useMemberIntelligence(member.employeeId);

  return (
    <div className="border-t border-border px-4 pb-4 pt-3 space-y-4 bg-secondary/10">
      {/* Quick metrics */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Clock-ins", value: member.attendance.clockInCount },
          { label: "Late", value: member.attendance.lateArrivals },
          { label: "Streak", value: `${member.attendance.streakDays}d` },
          { label: "Kudos", value: member.kudos.recent },
        ].map((s) => (
          <div key={s.label} className="rounded bg-card border border-border py-2">
            <div className="text-base font-bold">{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      {member.insights.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary">
            Insights
          </div>
          {member.insights.map((ins, i) => (
            <div key={i} className="text-xs flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              {ins}
            </div>
          ))}
        </div>
      )}

      {/* Risk flags */}
      {(member.riskFlags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(member.riskFlags || []).map((f: string) => (
            <span
              key={f}
              className="text-[10px] px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Task breakdown */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
          Task breakdown
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
          {[
            { label: "Total", value: member.tasks.total },
            { label: "Done", value: member.tasks.done, color: "text-success" },
            { label: "Overdue", value: member.tasks.overdue, color: "text-destructive" },
            { label: "Rate", value: `${member.tasks.completionRate}%`, color: "text-info" },
          ].map((t) => (
            <div key={t.label} className="rounded bg-card border border-border py-1.5">
              <div className={`font-semibold ${t.color ?? ""}`}>{t.value}</div>
              <div className="text-[9px] text-muted-foreground">{t.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Deep-dive trends from API */}
      {loading && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3 w-3 animate-pulse text-primary" /> Loading deep-dive…
        </div>
      )}
      {data && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
            60-day task status
          </div>
          <div className="flex gap-2 text-xs">
            {Object.entries(data.trends.tasksByStatus).map(([k, v]) => (
              <div key={k} className="rounded border border-border bg-card px-2 py-1">
                <span className="font-semibold">{v}</span>
                <span className="text-muted-foreground ml-1">{k}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Comparison tab ───────────────────────────────────────────────────────────
function ComparisonTab({
  comparison,
}: {
  comparison: ReturnType<typeof useTeamIntelligence>["data"]["teamComparison"];
}) {
  if (comparison.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No cross-team data available yet.
      </div>
    );
  }

  const sorted = [...comparison].sort((a, b) => b.avgPerformance - a.avgPerformance);

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
        Sorted by avg performance · 30-day window
      </div>
      {sorted.map((t, i) => (
        <div key={t.team} className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-semibold">{t.team}</span>
              <span className="text-[10px] text-muted-foreground">{t.count} members</span>
            </div>
            <div className="flex items-center gap-1">
              {t.burnoutCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                  {t.burnoutCount} at risk
                </span>
              )}
              {i === 0 && <TrendingUp className="h-4 w-4 text-success" />}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              { label: "Performance", value: t.avgPerformance },
              { label: "Presence", value: t.avgPresence },
              { label: "Completion", value: t.avgCompletion },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-bold">{s.value}%</div>
                <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{ width: `${s.value}%` }}
                  />
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GovernanceTab({ definitions, targets }: { definitions?: any[]; targets?: any[] }) {
  const activeKpis = definitions || [];
  const activeTargets = targets || [];

  if (activeKpis.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No active KPI Definitions found in the system.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-4 w-4 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
          KPI Targets & Governance System
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {activeKpis.map((k) => {
          const kpiTargets = activeTargets.filter((t) => t.kpiId === k.id);
          return (
            <div key={k.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{k.name}</h3>
                  <code className="text-[10px] font-mono text-muted-foreground">{k.slug}</code>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-primary/10 text-primary border border-primary/20">
                  {k.frequency}
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {k.description || "No description provided."}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-border/50">
                <div>
                  <span className="text-muted-foreground block text-[9px] uppercase tracking-widest">
                    Category
                  </span>
                  <span className="font-medium text-foreground">{k.category || "General"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[9px] uppercase tracking-widest">
                    Owner Tier
                  </span>
                  <span className="font-medium text-foreground capitalize">
                    {k.ownerTier || "Any"}
                  </span>
                </div>
              </div>

              {kpiTargets.length > 0 ? (
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                    Target Thresholds
                  </div>
                  <div className="space-y-1">
                    {kpiTargets.map((t) => (
                      <div
                        key={t.id}
                        className="flex justify-between items-center text-xs font-mono"
                      >
                        <span className="text-muted-foreground capitalize">
                          {t.scopeType} {t.scopeId ? `(${t.scopeId})` : ""}:
                        </span>
                        <span className="font-bold text-foreground">
                          {k.targetType === "min" ? "≥" : "≤"}
                          {t.targetValue}{" "}
                          {k.unit === "percent" ? "%" : k.unit === "currency" ? " INR" : k.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-border/50 text-[10px] italic text-muted-foreground">
                  No targets configured for this definition.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
