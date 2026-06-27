import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRosterState } from "@/hooks/useRoster";
import { fetchAttendanceByDate, todayKey, statusFromEvents, fmtDuration, RosterEvent } from "@/lib/attendance-store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar } from "@/components/Avatar";
import { RoleGate } from "@/components/RoleGate";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/live-attendance")({
  component: () => (
    <RoleGate allow={["leadership", "zone_leader", "hr", "leader"]}>
      <LiveAttendancePage />
    </RoleGate>
  ),
});

function getLiveSummaryFromEvents(events: RosterEvent[]) {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  let workMs = 0, breakMs = 0, fieldMs = 0;
  let workStart: number | null = null;
  let breakStart: number | null = null;
  let fieldStart: number | null = null;

  for (const e of sorted) {
    if (e.kind === "clock_in") {
      workStart = e.ts;
    } else if (e.kind === "clock_out") {
      if (workStart) { workMs += e.ts - workStart; workStart = null; }
    } else if (e.kind === "break_start") {
      if (workStart) { workMs += e.ts - workStart; workStart = null; }
      breakStart = e.ts;
    } else if (e.kind === "break_end") {
      if (breakStart) { breakMs += e.ts - breakStart; breakStart = null; }
      workStart = e.ts;
    } else if (e.kind === "field_start") {
      if (workStart) { workMs += e.ts - workStart; workStart = null; }
      fieldStart = e.ts;
    } else if (e.kind === "field_end") {
      if (fieldStart) { fieldMs += e.ts - fieldStart; fieldStart = null; }
      workStart = e.ts;
    }
  }
  
  const now = Date.now();
  if (workStart)  workMs  += now - workStart;
  if (breakStart) breakMs += now - breakStart;
  if (fieldStart) fieldMs += now - fieldStart;

  return { workMs, breakMs, fieldMs };
}

function LiveAttendancePage() {
  const { roster, loading: rosterLoading } = useRosterState();
  const [events, setEvents] = useState<RosterEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [, setTick] = useState(0);
  const [filter, setFilter] = useState<"All" | "Clocked In" | "On Break" | "In Field">("All");

  useEffect(() => {
    const fetchData = () => {
      fetchAttendanceByDate(todayKey())
        .then(setEvents)
        .finally(() => setLoadingEvents(false));
    };
    
    // Initial fetch
    fetchData();
    
    // Fetch new events every 5 seconds for near-instant live updates
    const fetchInterval = setInterval(fetchData, 5000);
    
    // Force re-render every minute to tick durations up
    const tickInterval = setInterval(() => setTick(t => t + 1), 60000);
    
    return () => {
      clearInterval(fetchInterval);
      clearInterval(tickInterval);
    };
  }, []);



  const employees = roster.filter((e) => e.role !== "Admin");
  
  // Group events by employeeId
  const eventsByEmp = new Map<string, RosterEvent[]>();
  for (const e of events) {
    const list = eventsByEmp.get(e.employeeId) || [];
    list.push(e);
    eventsByEmp.set(e.employeeId, list);
  }

  const activeEmployees = employees.filter((e) => (eventsByEmp.get(e.id) || []).length > 0);

  const displayedEmployees = activeEmployees.filter(e => {
    if (filter === "All") return true;
    const empEvents = eventsByEmp.get(e.id) || [];
    const status = statusFromEvents(empEvents);
    return status === filter;
  });

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1200px] mx-auto">
      <header className="mb-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-4 transition-colors">
          &larr; Back to Dashboard
        </Link>
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
          Live Attendance
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">Time on Floor</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Check the live status of each employee today. Updates automatically.
        </p>
      </header>

      {rosterLoading || loadingEvents ? (
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-2 text-sm">
            {(["All", "Clocked In", "On Break", "In Field"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-md border font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {f === "Clocked In" ? "In Office" : f}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-card border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Live Status</TableHead>
              <TableHead>In Office</TableHead>
              <TableHead>On Break</TableHead>
              <TableHead>In Field</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedEmployees.map((e) => {
              const empEvents = eventsByEmp.get(e.id) || [];
              const status = statusFromEvents(empEvents);
              const summary = getLiveSummaryFromEvents(empEvents);
              return (
                <TableRow key={e.id}>
                  <TableCell className="flex items-center gap-3">
                    <Avatar id={e.id} size={32} />
                    <div>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.role}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] uppercase font-mono tracking-widest ${
                      status === "Clocked In" ? "bg-success/10 text-success" :
                      status === "On Break" ? "bg-warning/15 text-warning" :
                      status === "In Field" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {status === "Clocked In" ? "In Office" : status}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">{fmtDuration(summary.workMs)}</TableCell>
                  <TableCell className="font-mono">{fmtDuration(summary.breakMs)}</TableCell>
                  <TableCell className="font-mono">{fmtDuration(summary.fieldMs)}</TableCell>
                </TableRow>
              );
            })}
            {displayedEmployees.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {filter === "All" ? "No employees have clocked in today." : `No employees currently ${filter === "Clocked In" ? "In Office" : filter}.`}
                </TableCell>
              </TableRow>
            )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
