import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useRoster } from "@/hooks/useRoster";
import { Avatar } from "./Avatar";
import { Search } from "lucide-react";
import { LAUNCH_MODE, LAUNCH_ROUTES } from "@/config/launch-config";

// All navigable pages. Only the approved ones show up in launch mode.
const ALL_PAGES = [
  { kind: "page" as const, id: "p-home",       label: "Home",            sub: "Dashboard overview",        to: "/" },
  { kind: "page" as const, id: "p-attendance",  label: "Attendance",      sub: "Selfie clock-in & out",     to: "/attendance" },
  { kind: "page" as const, id: "p-pulse",       label: "Daily Pulse",     sub: "Check-in & team mood",      to: "/pulse" },
  { kind: "page" as const, id: "p-fly",         label: "Fly Board",       sub: "Real-time operations",      to: "/fly" },
  { kind: "page" as const, id: "p-tasks",       label: "Tasks",           sub: "Personal Kanban",           to: "/tasks" },
  { kind: "page" as const, id: "p-console",     label: "Operator Console",sub: "AI command center",         to: "/console" },
  { kind: "page" as const, id: "p-roster",      label: "Live Roster",     sub: "Live attendance map",       to: "/roster" },
  { kind: "page" as const, id: "p-kpis",        label: "KPI Governance",  sub: "Define & track metrics",    to: "/admin/kpis" },
  { kind: "page" as const, id: "p-kudos",       label: "Kudos",           sub: "Recognition wall",          to: "/kudos" },
  { kind: "page" as const, id: "p-1on1",        label: "Schedule 1:1",    sub: "Manager meeting notes",     to: "/one-on-ones" },
  { kind: "page" as const, id: "p-workforce",   label: "Workforce",       sub: "Roles, hierarchy, access",  to: "/admin/workforce" },
  // Permissions module – admin only, controlled by launch mode
  { kind: "page" as const, id: "p-permissions", label: "Permissions", sub: "Role‑based access control", to: "/admin/permissions" },
  // ── Hidden until future release ──────────────────────────────────────────
  { kind: "page" as const, id: "p-war-room",    label: "War Room",        sub: "Live ops command bridge",   to: "/war-room" },
  { kind: "page" as const, id: "p-calendar",    label: "Calendar",        sub: "All shifts, tours, tasks",  to: "/calendar" },
  { kind: "page" as const, id: "p-score",       label: "Score card",      sub: "Your performance",          to: "/score" },
  { kind: "page" as const, id: "p-coach",       label: "Coach",           sub: "AI coaching center",        to: "/command" },
  { kind: "page" as const, id: "p-inbox",       label: "Inbox",           sub: "All notifications",         to: "/inbox" },
  { kind: "page" as const, id: "p-leaves",      label: "Leaves",          sub: "Leave management",          to: "/leaves" },
  { kind: "page" as const, id: "p-people",      label: "People",          sub: "Employee directory",        to: "/people" },
  { kind: "page" as const, id: "p-recruiting",  label: "Recruiting",      sub: "Hiring pipeline",           to: "/recruiting" },
  { kind: "page" as const, id: "p-hrms",        label: "HRMS",            sub: "HR management system",      to: "/hrms" },
  { kind: "page" as const, id: "p-zones",       label: "Zones",           sub: "Zone management",           to: "/zones" },
  { kind: "page" as const, id: "p-achievements",label: "Achievements",    sub: "Recognition badges",        to: "/achievements" },
];

// In launch mode only show approved routes; outside launch mode show all.
const STATIC_PAGES = LAUNCH_MODE
  ? ALL_PAGES.filter((p) => LAUNCH_ROUTES.has(p.to))
  : ALL_PAGES;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const roster = useRoster();

  // In launch mode don't expose the people search (navigates to /people)
  const peopleResults = useMemo(
    () =>
      LAUNCH_MODE
        ? []
        : roster.map((e) => ({
            kind: "person" as const,
            id: e.id,
            label: e.name,
            sub: `${e.role} · ${e.team}`,
            to: "/people",
          })),
    [roster],
  );

  const results = useMemo(
    () => [...peopleResults, ...STATIC_PAGES],
    [peopleResults],
  );

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = q
    ? results
        .filter((r) => (r.label + " " + (r.sub ?? "")).toLowerCase().includes(q.toLowerCase()))
        .slice(0, 12)
    : results.slice(0, 8);

  const Wrapper = "div" as const;

  return (
    <Wrapper
      className="fixed inset-0 z-[100] bg-sidebar/40 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <Wrapper
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Wrapper className="px-4 py-3 border-b border-border flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages, anything…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">
            ESC
          </kbd>
        </Wrapper>
        <Wrapper className="max-h-[420px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <Wrapper className="px-4 py-8 text-sm text-center text-muted-foreground">
              Nothing matches "{q}". Try a different word.
            </Wrapper>
          )}
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                navigate({ to: r.to });
                onClose();
              }}
              className="w-full text-left px-4 py-2 hover:bg-secondary/60 transition-colors flex items-center gap-3"
            >
              {r.kind === "person" ? (
                <Avatar id={r.id} size={32} />
              ) : (
                <Wrapper className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                  <Search className="h-3.5 w-3.5" />
                </Wrapper>
              )}
              <Wrapper className="min-w-0 flex-1">
                <Wrapper className="font-medium text-sm truncate">{r.label}</Wrapper>
                {r.sub && (
                  <Wrapper className="text-xs text-muted-foreground truncate">{r.sub}</Wrapper>
                )}
              </Wrapper>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {r.kind}
              </span>
            </button>
          ))}
        </Wrapper>
      </Wrapper>
    </Wrapper>
  );
}
