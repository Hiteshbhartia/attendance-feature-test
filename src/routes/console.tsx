import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  ShieldOff,
  Flame,
  Plus,
  Check,
  CheckCircle2,
  Clock,
  MessageSquare,
  Copy,
  Send,
  AlertTriangle,
  Zap,
  FileText,
  ChevronRight,
  Gavel,
  Sparkles,
  Activity,
  Target,
  ChevronDown,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useRoleFeature } from "@/hooks/useRoleFeature";
import { usePageTour } from "@/hooks/usePageTour";
import { useAttendanceState } from "@/hooks/useAttendance";
import { tierOf, hasConsoleCapability } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";
import {
  playbookStore,
  playbookFor,
  fmtMin,
  nowMin,
  type RolePlaybook,
  type PlaybookKey,
} from "@/lib/playbooks-store";
import {
  useConsoleDay,
  toggleSprint,
  markWindowSent,
  setEod,
  logDecision,
  shieldNow,
  currentSprint,
  nextSprint,
  exportEodText,
} from "@/lib/console-store";
import { useTasks, tasksFor, setStatus, requestTaskReason, scheduleOverdueMeeting, createTask, addComment, flushTasksSync } from "@/lib/task-store";
import { submitPulse } from "@/lib/pulse-store";
import type { AppTask } from "@/types/hr";
import { Avatar } from "@/components/Avatar";
import type { Employee } from "@/types/hr";
import { TeamIntelligencePanel } from "@/components/TeamIntelligencePanel";
import { LiveCountdown } from "@/components/LiveCountdown";
import { LeadershipActionsPanel } from "@/components/LeadershipActionsPanel";
import {
  fetchKpiDefinitions,
  fetchKpiTargets,
  type KpiDefinition,
  type KpiTarget,
} from "@/lib/kpi-governance-api";
import { AdminPulseView } from "./pulse";
import { api } from "@/lib/api-client";
export const Route = createFileRoute("/console")({
  component: ConsolePage,
  head: () => ({
    meta: [
      { title: "Operator Console — Gharpayy Arena" },
      {
        name: "description",
        content: "Sprint-by-sprint execution console for Gharpayy operators.",
      },
    ],
  }),
});

function useDynamicPlaybook(pb: RolePlaybook | undefined, actor: Employee) {
  const [definitions, setDefinitions] = useState<KpiDefinition[]>([]);
  const [targets, setTargets] = useState<KpiTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [kpiRes, targetRes] = await Promise.all([
          fetchKpiDefinitions({ active: true }),
          fetchKpiTargets(),
        ]);
        if (kpiRes?.definitions) setDefinitions(kpiRes.definitions);
        if (targetRes?.targets) setTargets(targetRes.targets);
      } catch (err) {
        console.error("Failed to load dynamic playbook KPIs", err);
      } finally {
        setLoading(false);
      }
    }
    if (pb && actor?.id && actor.id !== "loading") {
      load();
    } else {
      setLoading(false);
    }
  }, [pb?.key, actor?.id]);

  const dynamicPb = useMemo(() => {
    if (!pb) return undefined;
    if (loading || definitions.length === 0) return pb;

    const dynamicKpis = pb.kpis.map((legacyKpi: any) => {
      const expectedSlug = `${pb.id}_${legacyKpi.id}`;
      const definition = definitions.find((d) => d.slug === expectedSlug);

      if (!definition) {
        return legacyKpi;
      }

      const kpiTargets = targets.filter((t) => t.kpiId === definition.id);

      let resolvedTarget = legacyKpi.target;

      const individualTarget = kpiTargets.find(
        (t) => t.scopeType === "individual" && t.scopeId === actor.id,
      );
      const teamTarget = kpiTargets.find(
        (t) =>
          t.scopeType === "team" &&
          actor.team &&
          t.scopeId?.toLowerCase() === actor.team.toLowerCase(),
      );
      const zoneTarget = kpiTargets.find(
        (t) =>
          t.scopeType === "zone" &&
          actor.zone &&
          t.scopeId?.toLowerCase() === actor.zone.toLowerCase(),
      );
      const orgTarget = kpiTargets.find((t) => t.scopeType === "org");

      if (individualTarget !== undefined) {
        resolvedTarget = individualTarget.targetValue;
      } else if (teamTarget !== undefined) {
        resolvedTarget = teamTarget.targetValue;
      } else if (zoneTarget !== undefined) {
        resolvedTarget = zoneTarget.targetValue;
      } else if (orgTarget !== undefined) {
        resolvedTarget = orgTarget.targetValue;
      }

      return {
        id: legacyKpi.id,
        label: definition.name || legacyKpi.label,
        why: definition.description || legacyKpi.why,
        target: resolvedTarget,
        unit:
          definition.unit === "count"
            ? undefined
            : definition.unit === "percent"
              ? "%"
              : definition.unit,
        kind:
          definition.unit === "percent"
            ? "percent"
            : definition.unit === "boolean"
              ? "boolean"
              : legacyKpi.kind,
      };
    });

    return {
      ...pb,
      kpis: dynamicKpis,
    };
  }, [pb, definitions, targets, actor, loading]);

  return { pb: dynamicPb, loading };
}

function calculateDynamicHealth(
  kpis: Array<{ id: string; kind: string; target: number }>,
  dayKpis: Record<string, number>,
) {
  if (!kpis || kpis.length === 0) return { score: 0, label: "—" };
  let hit = 0;
  kpis.forEach((k) => {
    const v = dayKpis[k.id] ?? 0;
    if (k.kind === "boolean") {
      if (v >= 1) hit++;
    } else if (k.kind === "percent") {
      if (v >= k.target) hit++;
    } else {
      if (v >= k.target) hit++;
    }
  });
  const score = Math.round((hit / kpis.length) * 100);
  const label =
    score >= 90 ? "On fire" : score >= 70 ? "On track" : score >= 40 ? "Behind" : "Red zone";
  return { score, label };
}

function ConsolePage() {
  const { actor } = useAttendanceState();
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  // tick referenced to avoid unused warnings; force re-render every 30s
  void tick;

  usePageTour("console_tour", [
    {
      popover: {
        title: "Operations Command Center",
        description: "Welcome to the Operator Console. Here you can execute your daily sprints and manage your operations.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-console-header",
      popover: { title: "Operations Health", description: "Your daily execution metrics, overall health score, and current shield status.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-console-now-strip",
      popover: { title: "Current Sprint", description: "Track your current sprint progress and next upcoming block to stay on top of your schedule.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-console-comm-windows",
      popover: { title: "Communication Windows", description: "Send required updates and messages to your team or leaders during the allowed windows.", side: "right", align: "start" }
    },
    {
      element: "#tour-console-decisions",
      popover: { title: "Decisions Log", description: "Log escalations and decisions quickly without leaving the console.", side: "left", align: "start" }
    },
    {
      element: "#tour-console-team-intel",
      popover: { title: "Team Intelligence", description: "View AI-driven insights and health metrics about your team's performance.", side: "top", align: "start" }
    },
    {
      element: "#tour-console-leadership-actions",
      popover: { title: "Leadership Actions", description: "Intervene and manage workforce operations directly.", side: "top", align: "start" }
    }
  ]);

  const hasMyOps = hasConsoleCapability(actor, "access_playbooks");
  const hasTeamIntel = hasConsoleCapability(actor, "view_team_intelligence");
  const hasLeadActions = hasConsoleCapability(actor, "manage_workforce_interventions");

  // Resolve playbook BEFORE any early returns so hook call count is stable
  const playbookKey = actor.role.toLowerCase().replace(/\s+/g, "_");
  const staticPb = playbookFor(playbookKey);
  const { pb, loading } = useDynamicPlaybook(staticPb, actor);

  // Initial loading while actor data is being fetched
  if (actor.id === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground gap-2">
        <Activity className="h-5 w-5 animate-pulse text-primary" />
        <span className="text-sm font-mono uppercase tracking-widest">Loading Console…</span>
      </div>
    );
  }

  // While the dynamic playbook is loading, show the same loading UI
  if (hasMyOps && loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground gap-2">
        <Activity className="h-5 w-5 animate-pulse text-primary" />
        <span className="text-sm font-mono uppercase tracking-widest">Loading Console…</span>
      </div>
    );
  }

  // Permission check after data is ready
  if (!hasMyOps && !hasTeamIntel && !hasLeadActions) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ShieldOff className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h1 className="font-display text-xl font-semibold mb-2">Access Denied</h1>
          <p className="text-sm text-muted-foreground">You do not have permissions to access the Operations Command Center.</p>
        </div>
      </div>
    );
  }

  // Render the main console UI
  return (
    <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-8">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Operations Command Center</h1>
          <p className="text-xs text-muted-foreground">Real-time execution rhythm and intelligence</p>
        </div>
      </div>
          {hasMyOps && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              01 / My Operations
            </span>
          </div>
          <MyOperationsSection pb={pb} actorId={actor.id} actorName={actor.name} actor={actor} currentUserEmployeeId={user?.employeeId} />
        </div>
      )}
      

      {hasTeamIntel && (
        <div id="tour-console-team-intel" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {hasMyOps && pb ? "02" : "01"} / Team Intelligence
            </span>
          </div>
          <TeamIntelligencePanel actor={actor} />
        </div>
      )}
      {hasLeadActions && (
        <div id="tour-console-leadership-actions" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {hasMyOps && pb ? (hasTeamIntel ? "03" : "02") : (hasTeamIntel ? "02" : "01")} / Leadership Actions
            </span>
          </div>
          <LeadershipActionsPanel actor={actor} />
        </div>
      )}
      
      {/* 04 / Communication Window */}
      <CommunicationWindow actor={actor} currentUserEmployeeId={user?.employeeId} />
    </div>
  );
}

function MyOperationsSection({
  pb,
  actorId,
  actorName,
  actor,
  currentUserEmployeeId,
}: {
  pb: RolePlaybook;
  actorId: string;
  actorName: string;
  actor: ReturnType<typeof useAttendanceState>["actor"];
  currentUserEmployeeId?: string;
}) {
  const day = useConsoleDay(actorId);
  const shield = shieldNow(actorId);
  const sprint = currentSprint(actorId);
  const next = nextSprint(actorId);
  const health = useMemo(() => {
    return calculateDynamicHealth(pb.kpis, day.kpis);
  }, [pb.kpis, day.kpis]);

  const allTasks = useTasks();
  const myTasks = useMemo(() => allTasks.filter(t => t.assigneeId === actorId), [allTasks, actorId]);

  return (
    <div className="space-y-6">
      <div id="tour-console-header"><Header pb={pb} actorName={actorName} health={health} shield={shield} /></div>
      <div id="tour-console-now-strip"><NowStrip actorId={actorId} sprint={sprint} next={next} /></div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6" id="tour-console-comm-windows">

          <CommWindows pb={pb} actorId={actorId} day={day} />
        </div>
        <div className="space-y-6">
          <CollapseRule pb={pb} />
          <div id="tour-console-decisions"><DecisionsLog actorId={actorId} day={day} /></div>
          {hasConsoleCapability(actor, "submit_eod") && (
            <EodGenerator pb={pb} actorId={actorId} day={day} />
          )}
        </div>
      </div>
    </div>
  );
}

function Header({
  pb,
  actorName,
  health,
  shield,
}: {
  pb: RolePlaybook;
  actorName: string;
  health: { score: number; label: string };
  shield: { active: boolean; label: string; until?: number };
}) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/30 p-5 md:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Flame className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">
            {pb.subtitle}
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold leading-tight">
            {pb.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-3xl">{pb.oneLiner}</p>
          <p className="text-xs italic text-muted-foreground/80 mt-2 max-w-3xl">
            — Owned today by {actorName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center min-w-[88px]">
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
              Day score
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {health.score}
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <div
              className={`text-[10px] uppercase tracking-widest font-mono ${
                health.score >= 70
                  ? "text-success"
                  : health.score >= 40
                    ? "text-warning"
                    : "text-destructive"
              }`}
            >
              {health.label}
            </div>
          </div>
        </div>
      </div>

      {shield.active ? (
        <div className="mt-4 rounded-lg bg-primary/15 border border-primary/30 px-4 py-2.5 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-primary">
            Shield Mode active
          </span>
          <span className="text-sm">{shield.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            Until {fmtMin(shield.until ?? 0)}
          </span>
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-secondary/40 border border-border px-4 py-2.5 flex items-center gap-2 text-muted-foreground">
          <ShieldOff className="h-4 w-4" />
          <span className="font-mono text-[11px] uppercase tracking-widest">
            Shield mode off · communications open
          </span>
        </div>
      )}
    </div>
  );
}

function NowStrip({
  actorId,
  sprint,
  next,
}: {
  actorId: string;
  sprint?: ReturnType<typeof currentSprint>;
  next?: ReturnType<typeof nextSprint>;
}) {
  void actorId;
  const m = nowMin();
  if (sprint) {
    const pct = Math.round(((m - sprint.startMin) / (sprint.endMin - sprint.startMin)) * 100);
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
            Sprint {sprint.index} · live now
          </span>
          <span className="ml-auto text-xs font-mono text-muted-foreground">
            {fmtMin(sprint.startMin)} → {fmtMin(sprint.endMin)}
          </span>
        </div>
        <div className="text-base md:text-lg font-semibold">{sprint.name}</div>
        <p className="text-sm text-muted-foreground mt-1">{sprint.objective}</p>
        <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
          />
        </div>
        <div className="text-[10px] font-mono text-muted-foreground mt-1">
          {pct}% through this block
        </div>
      </div>
    );
  }
  if (next) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 md:p-5 flex items-center gap-3">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Next up
          </div>
          <div className="text-sm font-semibold">
            Sprint {next.index} · {next.name}
          </div>
        </div>
        <div className="text-xs font-mono text-primary">at {fmtMin(next.startMin)}</div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 text-sm text-muted-foreground flex items-center gap-2">
      <Sparkles className="h-4 w-4 text-primary" /> Day complete or off-hours. Use this time for EOD
      + tomorrow prep.
    </div>
  );
}




function CommWindows({
  pb,
  actorId,
  day,
}: {
  pb: RolePlaybook;
  actorId: string;
  day: ReturnType<typeof useConsoleDay>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>(["all"]);
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});
  const [customTemplates, setCustomTemplates] = useState<{id: string, title: string, time: string, text: string}[]>([]);
  const [generatingCustom, setGeneratingCustom] = useState(false);
  
  const allTasks = useTasks();
  const { user, actor: loggedInActor } = useAuth();
  const { employees } = useAttendanceState();
  const currentUserId = loggedInActor?.id || user?.employeeId || user?.id;

  const r = user?.role?.toLowerCase() || "";
  const ar = (user as any)?.appRole?.toLowerCase() || (user as any)?.profile?.appRole?.toLowerCase() || "";
  const isLeadership = 
    r.includes("admin") || r.includes("hr") || ar.includes("admin") || ar.includes("hr");

  const hasSentAnything = allTasks.some(task => task.relatedTo === "Admin Check-In" && (task.assigneeId === actorId || task.assignedById === currentUserId));

  if (!isLeadership && !hasSentAnything) return null;

  const operators = employees.filter(e => e.id !== currentUserId && !e.role.toLowerCase().includes("admin") && !e.role.toLowerCase().includes("hr") && e.id !== "loading");

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
        <SectionHead
          icon={MessageSquare}
          title="Communication windows"
          subtitle={
            pb.shieldBlocks.length > 0
              ? "Send these on time. Outside these, Shield Mode applies."
              : "Send these messages on time. Tap to copy the template."
          }
        />
        {isLeadership && actorId === currentUserId && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-xs bg-secondary/40 border border-border rounded p-2 min-w-[180px] font-medium flex items-center justify-between gap-2">
                <span>
                  {selectedTargets.includes("all") || selectedTargets.length === operators.length
                    ? "-- Send to All Operators --"
                    : selectedTargets.length === 0
                    ? "-- Select Operators --"
                    : `${selectedTargets.length} Operator${selectedTargets.length > 1 ? "s" : ""} Selected`}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-2" align="end">
              <div className="space-y-2">
                <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-secondary/40 rounded cursor-pointer">
                  <Checkbox
                    checked={selectedTargets.includes("all") || selectedTargets.length === operators.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTargets(["all"]);
                      } else {
                        setSelectedTargets([]);
                      }
                    }}
                  />
                  <span className="text-xs font-semibold">Select All</span>
                </label>
                <div className="h-px bg-border my-1" />
                <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
                  {operators.map(op => {
                    const isSelected = selectedTargets.includes("all") || selectedTargets.includes(op.id);
                    return (
                      <label key={op.id} className="flex items-center gap-2 px-2 py-1 hover:bg-secondary/40 rounded cursor-pointer">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              if (selectedTargets.includes("all")) {
                                // Already all, doing nothing
                              } else {
                                const next = [...selectedTargets, op.id];
                                setSelectedTargets(next.length === operators.length ? ["all"] : next);
                              }
                            } else {
                              if (selectedTargets.includes("all")) {
                                setSelectedTargets(operators.map(o => o.id).filter(id => id !== op.id));
                              } else {
                                setSelectedTargets(selectedTargets.filter(id => id !== op.id));
                              }
                            }
                          }}
                        />
                        <span className="text-xs truncate">{op.name} ({op.role})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="space-y-2">
        {[...ADMIN_TEMPLATES, ...customTemplates].map((t) => {
          const sentTaskOperator = allTasks.find(task => task.relatedTo === "Admin Check-In" && task.title.includes(t.title) && task.assigneeId === actorId);
          const sentTasksAdmin = isLeadership ? allTasks.filter(task => task.relatedTo === "Admin Check-In" && task.title.includes(t.title) && task.assignedById === currentUserId) : [];
          
          const isSent = isLeadership ? sentTasksAdmin.length > 0 : !!sentTaskOperator;
          
          if (!isLeadership && !isSent) return null;

          const isOpen = open === t.id;
          const currentText = draftTexts[t.id] ?? t.text;

          return (
            <div key={t.id} className={`rounded-lg border overflow-hidden transition-colors ${
              isSent ? "border-success/30 bg-success/5" : "border-border bg-card"
            }`}>
              <button
                onClick={() => setOpen(isOpen ? null : t.id)}
                className="w-full text-left p-3 flex items-center justify-between hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`mt-0.5 rounded ${isSent ? "text-success" : "text-muted-foreground"}`}>
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-left">
                    {t.id.startsWith("custom_") && isOpen && isLeadership ? (
                      <input
                        value={t.title}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setCustomTemplates(prev => prev.map(ct => ct.id === t.id ? { ...ct, title: e.target.value } : ct))}
                        className="text-sm font-semibold bg-transparent border-b border-primary/30 focus:border-primary outline-none px-0 py-0 w-full"
                      />
                    ) : (
                      <div className="text-sm font-semibold">{t.title}</div>
                    )}
                    <div className="text-xs text-muted-foreground">Admin Check-In · {t.time}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isSent ? (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-success flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Sent
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary flex items-center gap-1">
                      <Send className="h-3 w-3" /> Ready to send
                    </span>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-border p-3 space-y-2">
                  {isLeadership ? (
                    <textarea
                      value={currentText}
                      onChange={(e) => setDraftTexts(prev => ({ ...prev, [t.id]: e.target.value }))}
                      className="w-full text-xs bg-secondary/20 border border-border rounded-md p-3 font-sans leading-relaxed focus:bg-background focus:border-primary outline-none transition-colors min-h-[80px] resize-y"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-xs bg-secondary/40 rounded p-3 font-sans leading-relaxed">
                      {currentText}
                    </pre>
                  )}

                  {isLeadership && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const res = await api.post<{ text: string }>("/ai/template", {
                              mode: "generate_template",
                              title: t.title,
                              context: pb.key
                            });
                            if (res && res.text) {
                              setDraftTexts(prev => ({ ...prev, [t.id]: res.text }));
                            }
                          } catch (err) {
                            console.error("Failed to generate AI template", err);
                          }
                        }}
                        className="h-8 px-3 inline-flex items-center gap-1.5 rounded border border-purple-500/50 bg-purple-500/10 text-purple-600 hover:bg-purple-500 hover:text-white transition-colors text-xs font-medium"
                      >
                        <Sparkles className="h-3 w-3" /> Auto-draft
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard?.writeText(currentText);
                        }}
                        className="h-8 px-3 inline-flex items-center gap-1.5 rounded border border-border hover:bg-secondary text-xs"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const waText = currentText.replace(/\r?\n/g, '\r\n');
                          window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, "_blank");
                        }}
                        className="h-8 px-3 inline-flex items-center gap-1.5 rounded border border-[#25D366] bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors text-xs font-medium"
                      >
                        <MessageSquare className="h-3 w-3" /> Share on WhatsApp
                      </button>
                      <button
                        disabled={operators.length === 0}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!currentUserId || operators.length === 0) return;
                          
                          const targetOps = selectedTargets.includes("all") || selectedTargets.length === operators.length
                            ? operators 
                            : operators.filter(o => selectedTargets.includes(o.id));
                            
                          for (const op of targetOps) {
                            // avoid duplicates
                            const alreadySent = allTasks.some(task => task.relatedTo === "Admin Check-In" && task.title.includes(t.title) && task.assigneeId === op.id);
                            if (alreadySent) continue;
                            createTask({
                              title: `Admin Check-In: ${t.title}`,
                              description: currentText,
                              assigneeId: op.id,
                              assignedById: currentUserId,
                              priority: "urgent",
                              dueAt: Date.now() - 1000,
                              source: "manual",
                              relatedTo: "Admin Check-In",
                            });
                          }
                          await flushTasksSync();
                        }}
                        className={`h-8 px-3 inline-flex items-center gap-1.5 rounded border text-xs font-medium ${
                          operators.length === 0
                            ? "border-muted bg-muted text-muted-foreground cursor-not-allowed"
                            : "border-blue-600 bg-blue-600 text-white hover:bg-blue-500"
                        }`}
                      >
                        <Send className="h-3 w-3" /> {operators.length === 0 ? "No Operators" : "Send"}
                      </button>
                    </div>
                  )}

                  {isSent && (
                     <div className="mt-3 pt-3 border-t border-success/20">
                      {isLeadership ? (
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-success mb-2 block">Operator Responses:</span>
                          {operators.map(op => {
                            const opTask = sentTasksAdmin.find(task => task.assigneeId === op.id);
                            if (!opTask) return null;
                            return (
                              <div key={op.id} className="border border-border/50 rounded p-2 bg-secondary/10">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-[10px] font-bold text-muted-foreground">{op.name}</div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const waText = (opTask.description || "").replace(/\r?\n/g, '\r\n');
                                      window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, "_blank");
                                    }}
                                    className="text-[#25D366] hover:text-[#20bd5a] p-1 bg-[#25D366]/10 rounded flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
                                  >
                                    <MessageSquare className="h-2.5 w-2.5" /> WA
                                  </button>
                                </div>
                                {opTask.comments && opTask.comments.length > 0 ? (
                                  <div className="text-xs text-foreground bg-secondary/50 p-2 rounded whitespace-pre-wrap">
                                    {opTask.comments[opTask.comments.length - 1].body}
                                  </div>
                                ) : (
                                  <div className="text-xs text-warning italic flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Waiting for response...
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          {currentUserId === actorId && sentTaskOperator?.status !== "done" ? (
                            <CheckInResponseForm task={sentTaskOperator!} />
                          ) : (
                            <>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-success mb-1 block">Your Response:</span>
                              {sentTaskOperator?.comments && sentTaskOperator.comments.length > 0 ? (
                                <div className="text-xs text-foreground bg-secondary/50 p-2 rounded whitespace-pre-wrap">
                                  {sentTaskOperator.comments[sentTaskOperator.comments.length - 1].body}
                                </div>
                              ) : null}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CollapseRule({ pb }: { pb: RolePlaybook }) {
  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-destructive">
          Process collapse rule
        </span>
      </div>
      <p className="text-sm leading-relaxed">{pb.collapseRule}</p>
      <div className="mt-3 pt-3 border-t border-destructive/20 text-xs italic text-muted-foreground">
        {pb.interdependence}
      </div>
    </section>
  );
}

function DecisionsLog({
  actorId,
  day,
}: {
  actorId: string;
  day: ReturnType<typeof useConsoleDay>;
}) {
  const [text, setText] = useState("");
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gavel className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold">Hard decisions today</h3>
      </div>
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., Issued formal warning to X for second late entry."
          className="w-full text-sm bg-secondary/40 border border-border rounded p-2 min-h-[60px] resize-y"
        />
        <button
          onClick={() => {
            logDecision(actorId, text);
            setText("");
          }}
          disabled={!text.trim()}
          className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Log decision
        </button>
      </div>
      <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
        {day.decisions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No hard decisions logged yet today. Easy decisions protect individuals; hard decisions
            protect Gharpayy.
          </p>
        ) : (
          day.decisions.map((d) => (
            <div
              key={d.id}
              className="text-xs bg-secondary/30 rounded p-2 border-l-2 border-primary"
            >
              <div className="font-mono text-[10px] text-muted-foreground">
                {new Date(d.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div>{d.text}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function EodGenerator({
  pb,
  actorId,
  day,
}: {
  pb: RolePlaybook;
  actorId: string;
  day: ReturnType<typeof useConsoleDay>;
}) {
  const [previewText, setPreviewText] = useState<string | null>(null);
  const hasFeature = useRoleFeature();

  const generateDraft = () => {
    let text = exportEodText(actorId, pb.id as PlaybookKey);
    const tasks = tasksFor(actorId);
    const todayStr = new Date().toDateString();
    const todayTasks = tasks.filter((t: any) => t.dueAt && new Date(t.dueAt).toDateString() === todayStr);
    
    if (todayTasks.length > 0) {
      const done = todayTasks.filter((t: any) => t.status === "DONE");
      const pending = todayTasks.filter((t: any) => t.status !== "DONE");
      text += `\n\nTasks Completed:\n${done.length ? done.map((t: any) => `• ${t.title}`).join("\n") : "None"}`;
      text += `\n\nTasks Pending:\n${pending.length ? pending.map((t: any) => `• ${t.title}`).join("\n") : "None"}`;
    }
    return text;
  };
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold">EOD Report</h3>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {pb.eodFields.map((f: any) => (
          <div key={f.id}>
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              {f.label}
            </label>
            {f.kind === "yesno" ? (
              <div className="flex gap-1 mt-0.5">
                {(["Yes", "No"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setEod(actorId, f.id, opt)}
                    className={`flex-1 h-7 text-xs rounded border ${
                      day.eod[f.id] === opt
                        ? opt === "Yes"
                          ? "border-success/40 bg-success/15 text-success"
                          : "border-destructive/40 bg-destructive/15 text-destructive"
                        : "border-border bg-secondary"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : f.kind === "number" ? (
              <input
                type="number"
                value={day.eod[f.id] ?? ""}
                onChange={(e) => setEod(actorId, f.id, e.target.value)}
                className="w-full h-8 px-2 text-sm bg-secondary/40 border border-border rounded mt-0.5"
              />
            ) : f.kind === "text" ? (
              <input
                type="text"
                value={day.eod[f.id] ?? ""}
                onChange={(e) => setEod(actorId, f.id, e.target.value)}
                placeholder={f.placeholder}
                className="w-full h-8 px-2 text-sm bg-secondary/40 border border-border rounded mt-0.5"
              />
            ) : (
              <textarea
                value={day.eod[f.id] ?? ""}
                onChange={(e) => setEod(actorId, f.id, e.target.value)}
                placeholder={f.placeholder}
                rows={3}
                className="w-full px-2 py-1 text-sm bg-secondary/40 border border-border rounded mt-0.5 resize-y"
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-border">
        <button
          onClick={() => setPreviewText((v) => (v === null ? generateDraft() : null))}
          className="flex-1 h-8 inline-flex items-center justify-center gap-1.5 rounded border border-border hover:bg-secondary text-xs"
        >
          {previewText !== null ? "Hide" : "Preview"}
        </button>
        <button
          onClick={() => {
            const textToCopy = previewText !== null ? previewText : generateDraft();
            navigator.clipboard?.writeText(textToCopy);
            // Sync with pulse store
            submitPulse({
              employeeId: actorId,
              slot: "eod",
              text: textToCopy,
            });
          }}
          className="flex-1 h-8 inline-flex items-center justify-center gap-1.5 rounded bg-primary text-primary-foreground text-xs font-medium"
        >
          <Copy className="h-3 w-3" /> Copy & Submit report
        </button>
      </div>
      {previewText !== null && (
        <textarea
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          className="mt-3 w-full text-[11px] bg-secondary/40 border border-border rounded p-3 font-mono leading-relaxed min-h-[200px] resize-y"
        />
      )}
      {hasFeature("/inbox") && (
        <div className="mt-3 text-[11px] text-muted-foreground">
          <Link to="/inbox" className="text-primary hover:underline">
            View inbox
          </Link>{" "}
          to send the digest.
        </div>
      )}
    </section>
  );
}

function SectionHead({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Target;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}



// expose role list for debugging — referenced for tree-shake safety
export const __PLAYBOOK_KEYS__ = () => Object.keys(playbookStore.read().playbooks);

const ADMIN_TEMPLATES = [
  {
    id: "check_1pm",
    title: "1 PM Initial Check",
    time: "1 PM",
    text: `*1 PM CHECK-IN*

*Drafts done (Target: 30)* - 
*Super Leads* - 
*U1 Calls connected (Target: 30)* - 
*Tours planned / done* - 
*CX Issues / Blockers* - 

_Prioritize value creation, maintain a focused agenda, and optimize time management._`
  },
  {
    id: "check_5pm",
    title: "5 PM Mid-Day Check",
    time: "5 PM",
    text: `*5 PM CHECK-IN (Target: 40% more than 1 PM)*

*Drafts done* - 
*Super Leads* - 
*U1 Calls connected* - 
*Tours planned / done* - 
*CX Issues / Blockers* - `
  },
  {
    id: "check_8pm",
    title: "8 PM EOD Check",
    time: "8 PM",
    text: `*8 PM EOD WRAP-UP*

*Total Drafts* - 
*Total Super Leads* - 
*Total U1 Calls connected* - 
*Total Tours planned / done* - 
*Key learnings / Blockers for tomorrow* - `
  }
];



function CheckInResponseForm({ task }: { task: AppTask }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const allTasks = useTasks();

  const handleSend = () => {
    if (!text.trim()) return;
    setSubmitting(true);
    addComment(task.id, task.assigneeId, text);
    setStatus(task.id, "done", task.assigneeId);
    setTimeout(() => setSubmitting(false), 500);
  };

  const handleAIPolish = async () => {
    if (!text.trim()) return;
    setPolishing(true);
    try {
      const res = await api.post<{ text: string }>("/ai/template", {
        mode: "polish_pulse",
        context: text
      });
      if (res && res.text) {
        setText(res.text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPolishing(false);
    }
  };

  const handleAiFill = async () => {
    setSubmitting(true);
    try {
      const myActiveTasks = allTasks.filter(t => t.assigneeId === task.assigneeId && t.status !== "done").map(t => ({ title: t.title, status: t.status }));
      const myCompletedTasks = allTasks.filter(t => t.assigneeId === task.assigneeId && t.status === "done").map(t => ({ title: t.title, status: "completed" }));
      const res = await api.post<{ text: string }>("/ai/template", {
        mode: "fill_response",
        context: task.description,
        tasks: [...myActiveTasks, ...myCompletedTasks]
      });
      if (res && res.text) {
        setText(res.text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-auto pt-4 border-t border-destructive/10 flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your completed check-in here..."
        className="w-full text-xs bg-secondary/40 border border-border rounded p-3 min-h-[80px] resize-y"
      />
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleAIPolish}
          disabled={!text.trim() || polishing || submitting}
          className="flex-1 flex items-center justify-center gap-2 bg-purple-500/10 text-purple-600 border border-purple-500/30 hover:bg-purple-500 hover:text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> {polishing ? "Polishing..." : "AI Polish"}
        </button>

        <button
          onClick={handleSend}
          disabled={!text.trim() || submitting}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" /> Send Response
        </button>
      </div>
    </div>
  );
}

function CommunicationWindow({ actor, currentUserEmployeeId }: { actor: ReturnType<typeof useAttendanceState>["actor"]; currentUserEmployeeId?: string }) {
  const allTasks = useTasks();
  const { user, actor: loggedInActor } = useAuth();
  
  const currentUserId = currentUserEmployeeId || loggedInActor?.id || user?.employeeId || user?.id;
  
  const r = user?.role?.toLowerCase() || actor?.role?.toLowerCase() || "";
  const ar = (user as any)?.appRole?.toLowerCase() || (user as any)?.profile?.appRole?.toLowerCase() || (actor as any)?.appRole?.toLowerCase() || (actor as any)?.profile?.appRole?.toLowerCase() || "";
  
  const isLeadership = 
    tierOf(actor) === "hr" || 
    tierOf(actor) === "leadership" || 
    tierOf(actor) === "zone_leader" || 
    r.includes("admin") || 
    r.includes("hr") || 
    ar.includes("admin") ||
    ar.includes("hr");

  // Find overdue tasks that are not done
  const overdueTasks = allTasks.filter(t => t.status !== "done" && t.dueAt < Date.now() && t.assigneeId === actor.id && t.relatedTo !== "Admin Check-In");

  if (overdueTasks.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <span className="text-xs font-mono uppercase tracking-widest text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Urgent Tasks & Responses
        </span>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {overdueTasks.map(task => (
          <div key={task.id} className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 flex flex-col justify-between gap-4 transition-all hover:bg-destructive/10">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-destructive text-destructive-foreground rounded-full">
                  Urgent
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {Math.round((Date.now() - task.dueAt) / 60000)}m overdue
                </span>
              </div>
              <h3 className="font-semibold text-foreground mb-1 leading-tight">{task.title}</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Assigned to: <span className="font-medium text-foreground">{task.assigneeId}</span>
              </p>
            </div>
            
            {hasConsoleCapability(actor, "manage_workforce_interventions") && currentUserEmployeeId && currentUserEmployeeId !== task.assigneeId && (
              <div className="flex flex-col sm:flex-row gap-2 mt-auto pt-4 border-t border-destructive/10">
                <button
                  onClick={() => requestTaskReason(task.id, currentUserEmployeeId)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Ask Reason
                </button>
                <button
                  onClick={() => scheduleOverdueMeeting(task.assigneeId, task.id, currentUserEmployeeId)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Schedule Mtg
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
