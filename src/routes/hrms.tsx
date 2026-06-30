import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type AppRole } from "@/types/hr";
import { useRosterState } from "@/hooks/useRoster";
import { CAP_LIST, ROLE_LABEL, ROLE_DESC, can } from "@/lib/permissions";
import { computeScore } from "@/lib/score-engine";
import { liveStatusFor } from "@/lib/attendance-store";
import { Avatar } from "@/components/Avatar";
import { useAttendanceState } from "@/hooks/useAttendance";
import { ShieldCheck, Users, UserCog, User, Check, X, ChevronRight, Loader2 } from "lucide-react";
import { useRoleFeature } from "@/hooks/useRoleFeature";

import { RoleGate } from "@/components/RoleGate";

export const Route = createFileRoute("/hrms")({
  component: () => (
    <RoleGate allow={["leadership", "hr"]}>
      <HrmsPage />
    </RoleGate>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">HRMS error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

const ROLE_ICON: Record<AppRole, React.ElementType> = {
  admin: ShieldCheck,
  hr: ShieldCheck,
  manager: UserCog,
  employee: User,
};

const ROLE_TONE: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/30",
  hr: "bg-warning/10 text-warning border-warning/30",
  manager: "bg-primary/10 text-primary border-primary/30",
  employee: "bg-info/10 text-info border-info/30",
};

function HrmsPage() {
  const { actor } = useAttendanceState();
  const { roster, loading } = useRosterState();
  const [activeRole, setActiveRole] = useState<AppRole>(actor.appRole);
  const hasFeature = useRoleFeature();

  const grouped = useMemo(
    () => ({
      admin: roster.filter((e) => e.appRole === "admin"),
      hr: roster.filter((e) => e.appRole === "hr"),
      manager: roster.filter((e) => e.appRole === "manager"),
      employee: roster.filter((e) => e.appRole === "employee"),
    }),
    [roster],
  );

  const groupedCaps = useMemo(() => {
    const m = new Map<string, typeof CAP_LIST>();
    CAP_LIST.forEach((c) => {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group)!.push(c);
    });
    return Array.from(m.entries());
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
      <header className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
          People Operations
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">
          HRMS Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Roles, permissions and people — one source of truth.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {(["admin", "hr", "manager", "employee"] as AppRole[]).map((r) => {
          const Icon = ROLE_ICON[r];
          const list = grouped[r];
          const active = activeRole === r;
          return (
            <button
              key={r}
              onClick={() => setActiveRole(r)}
              className={`text-left rounded-2xl border p-4 transition-all ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${ROLE_TONE[r]}`}
                >
                  <Icon className="h-3 w-3" /> {ROLE_LABEL[r]}
                </span>
                <span className="font-display text-2xl font-semibold">{list.length}</span>
              </div>
              <div className="text-xs text-muted-foreground leading-snug">{ROLE_DESC[r]}</div>
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-display text-base md:text-lg font-semibold">
                {ROLE_LABEL[activeRole]} roster
              </h2>
              <p className="text-xs text-muted-foreground">
                {grouped[activeRole].length} people · live presence
              </p>
            </div>
            {hasFeature("/people") && (
              <Link to="/people" className="text-xs text-primary hover:underline hidden sm:inline">
                All people →
              </Link>
            )}
          </div>
          <div className="divide-y divide-border">
            {grouped[activeRole].map((e) => {
              const status = liveStatusFor(e.id);
              const score = computeScore(e).total;
              const dot =
                status === "Clocked In"
                  ? "bg-success"
                  : status === "On Break"
                    ? "bg-warning"
                    : status === "In Field"
                      ? "bg-primary"
                      : "bg-muted-foreground/40";
              return (
                <div key={e.id} className="px-4 md:px-5 py-3 flex items-center gap-3">
                  <Avatar id={e.id} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{e.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {e.role} · {e.team}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    <span className="hidden sm:inline">{status}</span>
                  </div>
                  <div className="w-12 text-right">
                    <div className="font-mono text-sm font-semibold">{score}</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      score
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border">
            <h2 className="font-display text-base md:text-lg font-semibold">
              Permissions for {ROLE_LABEL[activeRole]}
            </h2>
            <p className="text-xs text-muted-foreground">What they can and can't do.</p>
          </div>
          <div className="divide-y divide-border">
            {groupedCaps.map(([group, caps]) => (
              <div key={group} className="px-4 md:px-5 py-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                  {group}
                </div>
                <ul className="space-y-1.5">
                  {caps.map((c) => {
                    const allowed = can(activeRole, c.cap);
                    return (
                      <li key={c.cap} className="flex items-center gap-2 text-sm">
                        {allowed ? (
                          <Check className="h-3.5 w-3.5 text-success shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        )}
                        <span
                          className={
                            allowed ? "text-foreground" : "text-muted-foreground line-through"
                          }
                        >
                          {c.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border">
          <h2 className="font-display text-base md:text-lg font-semibold">Quick actions</h2>
          <p className="text-xs text-muted-foreground">Where each role spends its time.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 md:p-5">
          <ActionCard
            to="/roster"
            title="Live roster"
            sub="Who's where, right now"
            icon={Users}
            show={can(activeRole, "view_all_attendance") && hasFeature("/roster")}
          />
          <ActionCard
            to="/leaves"
            title="Approve leaves"
            sub="Clear the queue"
            icon={ShieldCheck}
            show={can(activeRole, "approve_leaves") && hasFeature("/leaves")}
          />
          <ActionCard
            to="/tasks"
            title="Assign tasks"
            sub="Move the team forward"
            icon={UserCog}
            show={can(activeRole, "assign_tasks_team") && hasFeature("/tasks")}
          />
          <ActionCard
            to="/score"
            title="Your score"
            sub="See where you stand"
            icon={User}
            show={can(activeRole, "view_own_score") && hasFeature("/score")}
          />
          <ActionCard
            to="/admin/workforce"
            title="Workforce access"
            sub="Roles, hierarchy, approvals"
            icon={UserCog}
            show={hasFeature("/admin/workforce")}
          />
          <ActionCard
            to="/war-room"
            title="War Room"
            sub="Daily snapshot"
            icon={ShieldCheck}
            show={can(activeRole, "view_war_room") && hasFeature("/war-room")}
          />
          <ActionCard
            to="/achievements"
            title="Achievements"
            sub="Recognition wall"
            icon={ShieldCheck}
            show={hasFeature("/achievements")}
          />
        </div>
      </section>
    </div>
  );
}

function ActionCard({
  to,
  title,
  sub,
  icon: Icon,
  show,
}: {
  to: string;
  title: string;
  sub: string;
  icon: React.ElementType;
  show: boolean;
}) {
  if (!show) return null;
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-colors p-3"
    >
      <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-[11px] text-muted-foreground truncate">{sub}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
    </Link>
  );
}
