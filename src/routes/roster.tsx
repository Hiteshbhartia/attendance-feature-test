import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAttendanceState } from "@/hooks/useAttendance";
import {
  fmtDuration,
  fmtTime,
  getEventsFor,
  liveStatusFor,
  todayKey,
  todaySummary,
  fetchAttendanceByDate,
  statusFromEvents,
  summaryFromEvents,
  type AttEvent,
  type RosterEvent,
} from "@/lib/attendance-store";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin,
  Camera,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useRosterState } from "@/hooks/useRoster";
import type { Employee } from "@/types/hr";
import { Input } from "@/components/ui/input";
import { Search, Filter, CheckCircle2, XCircle, Clock } from "lucide-react";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/roster")({
  head: () => ({
    meta: [
      { title: "Live Roster — Gharpayy Core" },
      {
        name: "description",
        content:
          "Admin live roster: who is clocked in, on break, in the field, or absent — with selfies and last known location.",
      },
    ],
  }),
  component: () => (
    <RoleGate allow={["leadership", "zone_leader", "hr", "leader"]}>
      <RosterPage />
    </RoleGate>
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Unified row shape used by both today (from store) and historical (from API). */
type RosterRow = {
  empId: string;
  empName: string;
  empRole: string;
  empTeam: string;
  empAppRole?: string;
  /** Employee record — present for today view, may be absent for historical */
  emp?: Employee;
  events: (AttEvent | RosterEvent)[];
  status: string;
  workMs: number;
  breakMs: number;
  fieldMs: number;
  firstClockIn: number | null;
  lastClockOut: number | null;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function RosterPage() {
  const { actor } = useAttendanceState();
  const { roster, loading: rosterLoading } = useRosterState();
  const today = todayKey();

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const isToday = selectedDate === today;

  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const teams = Array.from(new Set(roster.map((r) => r.team).filter(Boolean))).sort();

  // Historical fetch state
  const [histEvents, setHistEvents] = useState<RosterEvent[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  useEffect(() => {
    if (isToday) {
      setHistEvents([]);
      setHistError(null);
      return;
    }
    let cancelled = false;
    setHistLoading(true);
    setHistError(null);
    fetchAttendanceByDate(selectedDate)
      .then((items) => {
        if (!cancelled) setHistEvents(items);
      })
      .catch((err) => {
        if (!cancelled)
          setHistError(err instanceof Error ? err.message : "Failed to load attendance");
      })
      .finally(() => {
        if (!cancelled) setHistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, isToday]);

  const loading = rosterLoading || histLoading;

  usePageTour("roster_tour", [
    {
      element: "#tour-roster-metrics",
      popover: { title: "Roster Metrics", description: "See how many employees are currently clocked in, on break, or in the field at a glance.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-roster-filters",
      popover: { title: "Filters", description: "Filter the roster by team or current status, and even search for a specific employee.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-roster-datepicker",
      popover: { title: "Historical Data", description: "Use this date picker to view attendance records from past dates.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-roster-cards",
      popover: { title: "Employee Cards", description: "View the live status of each employee. Click on a card to view their full profile.", side: "top", align: "start" }
    }
  ]);

  // ---------------------------------------------------------------------------
  // Build rows
  // ---------------------------------------------------------------------------

  let rows: RosterRow[] = [];

  if (isToday) {
    // Today: use the in-memory store exactly as before
    rows = roster.map((e) => {
      const events = getEventsFor(e.id, today);
      const summary = todaySummary(e.id);
      const status = liveStatusFor(e.id);
      return {
        empId: e.id,
        empName: e.name,
        empRole: e.role,
        empTeam: e.team,
        empAppRole: e.appRole,
        emp: e,
        events,
        status,
        workMs: summary.workMs,
        breakMs: summary.breakMs,
        fieldMs: summary.fieldMs,
        firstClockIn: summary.firstClockIn,
        lastClockOut: summary.lastClockOut,
      };
    });
  } else {
    // Historical: group events by employeeId
    const byEmp = new Map<string, RosterEvent[]>();
    for (const ev of histEvents) {
      const arr = byEmp.get(ev.employeeId) ?? [];
      arr.push(ev);
      byEmp.set(ev.employeeId, arr);
    }

    // Also include roster employees who have no events (show as absent)
    const seenIds = new Set(byEmp.keys());
    for (const e of roster) {
      if (!seenIds.has(e.id)) {
        byEmp.set(e.id, []);
      }
    }

    for (const [empId, events] of byEmp.entries()) {
      // Prefer name/role from the live roster; fall back to what the API returned
      const rosterEmp = roster.find((e) => e.id === empId);
      const firstEv = events[0];
      const summary = summaryFromEvents(events);
      const status = statusFromEvents(events);
      rows.push({
        empId,
        empName: rosterEmp?.name ?? firstEv?.employeeName ?? empId,
        empRole: rosterEmp?.role ?? firstEv?.employeeRole ?? "—",
        empTeam: rosterEmp?.team ?? firstEv?.employeeTeam ?? "HQ",
        empAppRole: rosterEmp?.appRole,
        emp: rosterEmp,
        events,
        status,
        ...summary,
      });
    }

    // Sort: employees with events first, then alphabetically
    rows.sort((a, b) => {
      const aHas = a.events.length > 0 ? 0 : 1;
      const bHas = b.events.length > 0 ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.empName.localeCompare(b.empName);
    });
  }

  // Apply filters
  rows = rows.filter((r) => {
    if (teamFilter !== "all" && r.empTeam !== teamFilter) return false;
    if (statusFilter !== "all") {
      if (statusFilter === "absent" && r.status !== "Off") return false;
      if (statusFilter === "clocked_in" && r.status !== "Clocked In") return false;
      if (statusFilter === "break" && r.status !== "On Break") return false;
      if (statusFilter === "field" && r.status !== "In Field") return false;
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      if (!r.empName.toLowerCase().includes(q) && !r.empRole.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const counts = {
    "Clocked In": rows.filter((r) => r.status === "Clocked In").length,
    "On Break": rows.filter((r) => r.status === "On Break").length,
    "In Field": rows.filter((r) => r.status === "In Field").length,
    Off: rows.filter((r) => r.status === "Off").length,
  };

  return (
    <div className="p-4 md:p-8 space-y-6 overflow-x-hidden max-w-full">
      <header className="flex flex-col gap-6 bg-card p-4 md:p-6 rounded-2xl border border-border shadow-sm w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-primary font-mono mb-1">
              {isToday ? "Live Roster · Admin View" : `Attendance History · ${selectedDate}`}
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {isToday ? "Who's where, right now" : "Historical Attendance"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track attendance, live status, and absentees across teams.
            </p>
          </div>

          {/* Date picker */}
          <div id="tour-roster-datepicker" className="flex items-center gap-2 shrink-0">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value || today)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-sm transition-all"
              aria-label="Select attendance date"
            />
            {!isToday && (
              <button
                onClick={() => setSelectedDate(today)}
                className="h-10 px-4 rounded-lg border border-border bg-secondary text-xs font-mono uppercase tracking-widest hover:bg-secondary/70 transition-colors shadow-sm"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div id="tour-roster-filters" className="flex flex-col md:flex-row gap-3 items-center border-t border-border pt-5">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or role..."
              className="pl-9 h-10 bg-background"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <div className="w-[140px] shrink-0">
              <Select value={teamFilter} onValueChange={(val) => setTeamFilter(val)}>
                <SelectTrigger className="h-10 text-xs bg-background">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="All Teams" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[140px] shrink-0">
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                <SelectTrigger className="h-10 text-xs bg-background">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="All Statuses" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="clocked_in">Clocked In</SelectItem>
                  <SelectItem value="absent">Absent / Off</SelectItem>
                  <SelectItem value="break">On Break</SelectItem>
                  <SelectItem value="field">In Field</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {histError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {histError}
        </div>
      )}

      {/* Loading spinner */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div id="tour-roster-metrics" className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile 
              label="Clocked In" 
              value={counts["Clocked In"]} 
              tone="success" 
              onClick={() => setStatusFilter(statusFilter === "clocked_in" ? "all" : "clocked_in")}
              isActive={statusFilter === "clocked_in"}
            />
            <Tile 
              label="On Break" 
              value={counts["On Break"]} 
              tone="warning" 
              onClick={() => setStatusFilter(statusFilter === "break" ? "all" : "break")}
              isActive={statusFilter === "break"}
            />
            <Tile 
              label="In Field" 
              value={counts["In Field"]} 
              tone="primary" 
              onClick={() => setStatusFilter(statusFilter === "field" ? "all" : "field")}
              isActive={statusFilter === "field"}
            />
            <Tile 
              label="Off / Absent" 
              value={counts["Off"]} 
              tone="muted" 
              onClick={() => setStatusFilter(statusFilter === "absent" ? "all" : "absent")}
              isActive={statusFilter === "absent"}
            />
          </div>

          {rows.length === 0 && !isToday && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
              No attendance records found for {selectedDate}.
            </div>
          )}

          <div id="tour-roster-cards" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5 w-full">
            {rows.map((row) => (
              <RosterCard 
                key={row.empId} 
                row={row} 
                isToday={isToday} 
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RosterCard — reuses the exact same selfie + location UI as before.
// Now accepts the unified RosterRow instead of separate props.
// ---------------------------------------------------------------------------

function formatEventKind(kind: string) {
  return kind
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function RosterCard({ row, isToday }: { row: RosterRow; isToday: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  
  const sortedEvents = [...row.events].sort(
    (a: AttEvent | RosterEvent, b: AttEvent | RosterEvent) => b.ts - a.ts,
  );

  const subtitleParts = [row.empTeam, row.empRole, row.empAppRole].filter(Boolean);

  return (
    <Card 
      onClick={() => navigate({ to: `/employee/${row.empId}` })}
      className={`p-3 md:p-5 flex flex-col h-full border ${row.status === "Off" ? "border-destructive/20 bg-destructive/5" : "border-border shadow-sm bg-card hover:border-primary/20 hover:shadow-md transition-all"} cursor-pointer w-full overflow-hidden`}
    >
      <div className="flex items-start gap-2 md:gap-4 w-full">
        <Avatar className="h-10 w-10 md:h-14 md:w-14 shrink-0 border-2 border-background shadow-sm ring-1 ring-border">
          <AvatarImage 
            src={row.emp?.avatarSeed?.startsWith("data:image/") ? row.emp.avatarSeed : (row.emp?.avatarSeed ? `https://api.dicebear.com/9.x/notionists/svg?seed=${row.emp.avatarSeed}` : undefined)} 
            className="object-cover"
          />
          <AvatarFallback className={`${row.status === "Off" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"} font-medium text-xs md:text-sm`}>
            {row.empName
              .split(" ")
              .map((s: string) => s[0])
              .slice(0, 2)
              .join("")}
          </AvatarFallback>
        </Avatar>
<<<<<<< HEAD
        <div className="min-w-0 flex-1 pt-0.5">
=======
        <div className="min-w-0 flex-1 pt-0 md:pt-0.5">
>>>>>>> f51ee1c64d5d1af7d9428a894b8e0c39a2f44300
          <div className="flex items-start justify-between gap-1.5 md:gap-2 w-full">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[13px] md:text-[15px] truncate text-foreground">{row.empName}</div>
              <div className="text-[9px] md:text-xs text-muted-foreground truncate mt-0.5 font-medium">
                {subtitleParts.join(" · ")}
              </div>
            </div>
            <StatusBadge status={row.status} />
          </div>

          <div className="mt-2.5 md:mt-3 flex items-center justify-between">
            <div className="flex gap-1 md:gap-2 w-full">
              <Mini label="Work" value={fmtDuration(row.workMs)} active={row.status === "Clocked In"} />
              <Mini label="Break" value={fmtDuration(row.breakMs)} active={row.status === "On Break"} />
              <Mini label="Field" value={fmtDuration(row.fieldMs)} active={row.status === "In Field"} />
            </div>
          </div>

          {/* Clock-in / clock-out times for historical view */}
          {!isToday && (row.firstClockIn || row.lastClockOut) && (
            <div className="mt-3 flex items-center gap-3 text-[11px] font-mono bg-muted/50 rounded-md px-2 py-1.5 border border-border/50">
              {row.firstClockIn && (
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground uppercase tracking-widest text-[9px]">In:</span>
                  <span className="font-medium">{fmtTime(row.firstClockIn)}</span>
                </span>
              )}
              {row.lastClockOut && (
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground uppercase tracking-widest text-[9px]">Out:</span>
                  <span className="font-medium">{fmtTime(row.lastClockOut)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-border flex flex-col flex-1">
        {sortedEvents.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {row.events.length} event{row.events.length === 1 ? "" : "s"}
              </div>
              {row.events.length > 1 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-semibold uppercase tracking-widest font-mono bg-primary/5 px-2 py-1 rounded"
                >
                  {expanded ? "Collapse" : "Timeline"}
                  {expanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>

            {/* Event list — identical selfie + location rendering as before */}
            <div className="space-y-3">
              {sortedEvents
                .slice(0, expanded ? undefined : 1)
                .map((ev: AttEvent | RosterEvent, i: number) => (
                  <div key={ev.id} className={`flex gap-3 bg-muted/20 p-2 rounded-lg border border-border/40 ${i === 0 ? "shadow-sm bg-card" : "opacity-80"}`}>
                    {ev.selfie ? (
                      <a href={ev.selfie} target="_blank" rel="noreferrer" className="shrink-0 relative group">
                        <img
                          src={ev.selfie}
                          alt="selfie"
                          className="h-12 w-12 md:h-14 md:w-14 rounded-md object-cover border border-border shadow-sm bg-muted transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                          <ExternalLink className="h-4 w-4 text-white" />
                        </div>
                      </a>
                    ) : (
                      <div className="h-12 w-12 md:h-14 md:w-14 shrink-0 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground bg-muted/40">
                        <Camera className="h-4 w-4 md:h-5 md:w-5 opacity-50" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-[10px] md:text-[11px] font-bold uppercase tracking-widest font-mono ${
                            i === 0 ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {formatEventKind(ev.kind)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {fmtTime(ev.ts)}
                        </span>
                      </div>
                      <LocationLink
                        address={ev.address}
                        lat={ev.lat}
                        lng={ev.lng}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-destructive py-6 bg-destructive/5 rounded-lg border border-destructive/10">
            <XCircle className="h-6 w-6 opacity-80" />
            <div className="font-medium text-center">{isToday ? "Absent today" : "Marked Absent"}</div>
            <div className="text-xs opacity-70 text-center">No attendance punches found</div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Small shared components (unchanged from original)
// ---------------------------------------------------------------------------

function Tile({
  label,
  value,
  tone,
  onClick,
  isActive,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "primary" | "muted";
  onClick?: () => void;
  isActive?: boolean;
}) {
  const cls =
    tone === "success"
      ? "border-success/30 bg-success/5 text-success"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5 text-warning"
        : tone === "primary"
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-border bg-muted/30 text-muted-foreground";

  const activeClass = isActive ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "";
  const clickableClass = onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : "";

  return (
    <Card 
      className={`p-3 md:p-4 border ${cls} ${activeClass} ${clickableClass}`}
      onClick={onClick}
    >
      <div className="text-[9px] md:text-[10px] uppercase tracking-wider md:tracking-widest font-mono truncate">{label}</div>
      <div className="font-display text-2xl md:text-3xl font-semibold tabular-nums mt-1">{value}</div>
    </Card>
  );
}

function Mini({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={`rounded-md border px-1 md:px-2.5 py-1 md:py-1.5 text-center flex-1 min-w-0 ${active ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border/60"}`}>
      <div className={`text-[8px] md:text-[9px] uppercase tracking-wider font-semibold truncate ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</div>
      <div className={`text-[10px] md:text-xs font-mono tabular-nums mt-0.5 truncate ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LocationLink — renders 📍 address + "Open in Maps" link when lat/lng exist.
// Used for both today and historical events. No API key, no map embed.
// ---------------------------------------------------------------------------

function LocationLink({
  address,
  lat,
  lng,
}: {
  address: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
}) {
  const hasCoords = lat != null && lng != null;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;

  // Nothing to show if there's no address and no coords
  if (!address && !hasCoords) return null;

  const displayText = address ?? `${lat!.toFixed(5)}, ${lng!.toFixed(5)}`;

  return (
    <div className="mt-1 space-y-0.5">
      {/* 📍 Address line */}
      <div className="text-[11px] md:text-xs text-muted-foreground flex items-start gap-1.5 leading-snug">
        <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/70" />
        <span className="truncate" title={displayText}>
          {displayText}
        </span>
      </div>

      {/* "Open in Maps" link — only when coords are available */}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80 hover:underline transition-colors ml-4"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Open in Maps
        </a>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Clocked In"
      ? "bg-success/15 text-success border-success/30"
      : status === "On Break"
        ? "bg-warning/15 text-warning border-warning/30"
        : status === "In Field"
          ? "bg-primary/15 text-primary border-primary/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <Badge
      variant="outline"
      className={`${tone} border font-mono text-[9px] uppercase tracking-widest shrink-0 truncate max-w-[80px] md:max-w-none`}
    >
      {status}
    </Badge>
  );
}
