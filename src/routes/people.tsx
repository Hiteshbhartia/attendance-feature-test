import { createFileRoute, Link } from "@tanstack/react-router";
import type { AppRole } from "@/types/hr";
import { useRosterState } from "@/hooks/useRoster";
import { liveStatusFor } from "@/lib/attendance-store";
import { computeScore } from "@/lib/score-engine";
import { Avatar } from "@/components/Avatar";
import { useState } from "react";
import { Search, Loader2, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleGate } from "@/components/RoleGate";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/people")({
  component: () => (
    <RoleGate allow={["leadership", "zone_leader", "hr", "leader"]}>
      <PeoplePage />
    </RoleGate>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

const ROLE_TONE: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/30",
  hr: "bg-warning/10 text-warning border-warning/30",
  manager: "bg-primary/10 text-primary border-primary/30",
  employee: "bg-info/10 text-info border-info/30",
};

function PeoplePage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<AppRole | "all">("all");

  const [teamFilter, setTeamFilter] = useState<string>("all");
  const { roster, loading, isEmpty } = useRosterState();

  const teams = Array.from(new Set(roster.map((e) => e.team).filter(Boolean)));

  const list = roster.filter((e) => {
    if (filter !== "all" && e.appRole !== filter) return false;
    if (teamFilter !== "all" && e.team !== teamFilter) return false;
    if (!q) return true;
    const hay = (e.name + " " + e.role + " " + e.team + " " + (e.zone ?? "")).toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  usePageTour("people_directory_tour", [
    {
      element: "#tour-people-search",
      popover: { title: "Search & Filter", description: "Quickly find anyone in the organization by name, team, role, or access level.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-people-cards",
      popover: { title: "Employee Profiles", description: "View live statuses, titles, and team details for everyone across the org.", side: "top", align: "start" }
    }
  ]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1200px] mx-auto">
      <header className="mb-5">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
          Directory
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">People</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Everyone in the Arena. {roster.length} people · synced from database.
        </p>
      </header>
      <div id="tour-people-search" className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="w-[140px] shrink-0">
            <Select value={filter} onValueChange={(val) => setFilter(val as any)}>
              <SelectTrigger className="h-10 text-xs bg-card">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {teams.length > 0 && (
            <div className="w-[140px] shrink-0">
              <Select value={teamFilter} onValueChange={(val) => setTeamFilter(val)}>
                <SelectTrigger className="h-10 text-xs bg-card">
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex-1 inline-flex items-center gap-2 h-10 px-3 rounded-md bg-card border border-border">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, role, team…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>


      </div>
      {isEmpty && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No employees loaded yet. Check your API connection and refresh.
        </div>
      )}
      <div id="tour-people-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((e) => {
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
            <div
              key={e.id}
              className="rounded-2xl bg-card border border-border p-4 flex items-start gap-3"
            >
              <Avatar id={e.id} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{e.name}</div>
                  <span
                    className={`text-[9px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border ${ROLE_TONE[e.appRole]}`}
                  >
                    {e.appRole}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {e.role} · {e.team}
                </div>
                {e.bio && (
                  <div className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                    {e.bio}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    {status}
                  </div>
                  <Link to="/score" className="text-xs text-primary hover:underline">
                    Score {score}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
