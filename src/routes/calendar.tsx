import { createFileRoute } from "@tanstack/react-router";
import { useCalendarEvents, eventColor } from "@/lib/calendar-store";
import { getRoster } from "@/lib/roster";
import { Avatar } from "@/components/Avatar";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useZoneStore } from "@/lib/zones-store";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

function dayBucket(ts: number): string {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
}

function CalendarPage() {
  usePageTour("calendar_tour", [
    {
      popover: {
        title: "Calendar",
        description: "Welcome to your unified schedule! All your shifts, leaves, tasks, and company events live here.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-calendar-date-filter",
      popover: { title: "Date Navigation", description: "Jump to a specific date quickly.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-calendar-filters",
      popover: { title: "Filter Events", description: "Filter your calendar by event type (shifts, tasks, leaves) or by specific Zones.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-calendar-events",
      popover: { title: "Your Schedule", description: "Events are neatly categorized by day. Everything you need to know is here.", side: "top", align: "start" }
    }
  ]);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");

  const events = useCalendarEvents();
  const groups = new Map<string, typeof events>();
  const roster = getRoster();
  
  const { zones } = useZoneStore();
  const availableZones = zones.map(z => z.name).sort();

  events.forEach((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return;

    if (zoneFilter !== "all") {
      const owner = e.ownerId ? roster.find((x) => x.id === e.ownerId) : null;
      if (!owner || owner.zone !== zoneFilter) return;
    }

    if (dateFilter) {
      const evDate = new Date(e.startAt);
      const y = evDate.getFullYear();
      const m = String(evDate.getMonth() + 1).padStart(2, "0");
      const d = String(evDate.getDate()).padStart(2, "0");
      if (`${y}-${m}-${d}` !== dateFilter) return;
    }

    const key = dayBucket(e.startAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  });

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1100px] mx-auto">
      <header className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
            Schedule
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Shifts, tours, tasks, leaves — one timeline.
          </p>
        </div>

        <div id="tour-calendar-date-filter" className="flex items-center gap-2 shrink-0">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-sm transition-all"
            aria-label="Select date to filter"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="h-10 px-3 rounded-lg border border-border bg-secondary text-xs hover:bg-secondary/70 transition-colors shadow-sm flex items-center gap-1"
              title="Clear date filter"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </header>

      <div id="tour-calendar-filters" className="mb-5 flex flex-col sm:flex-row gap-3">
        <div className="w-[140px]">
          <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val as any)}>
            <SelectTrigger className="h-10 text-xs bg-card">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="shift">Shift</SelectItem>
              <SelectItem value="tour">Tour</SelectItem>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="leave">Leave</SelectItem>
              <SelectItem value="holiday">Holiday</SelectItem>
              <SelectItem value="birthday">Birthday</SelectItem>
              <SelectItem value="1:1">1:1</SelectItem>
              <SelectItem value="town_hall">Town Hall</SelectItem>
              <SelectItem value="anniversary">Anniversary</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-[140px]">
          <Select value={zoneFilter} onValueChange={(val) => setZoneFilter(val)}>
            <SelectTrigger className="h-10 text-xs bg-card">
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {availableZones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div id="tour-calendar-events" className="space-y-5">
        {groups.size === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground border border-border rounded-xl bg-card">
            No events found.
          </div>
        )}
        {Array.from(groups.entries()).map(([day, items]) => (
          <section key={day}>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
              {day}
            </div>
            <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
              {items.map((e) => {
                const owner = e.ownerId ? getRoster().find((x) => x.id === e.ownerId) : null;
                return (
                  <div key={e.id} className="px-4 md:px-5 py-3 flex items-center gap-3">
                    <div className="text-right shrink-0 w-16">
                      <div className="text-sm font-semibold">
                        {new Date(e.startAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {new Date(e.endAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`inline-block text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border mb-1 ${eventColor(e.type)}`}
                      >
                        {e.type}
                      </div>
                      <div className="font-medium text-sm truncate">{e.title}</div>
                      {e.location && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          {e.location}
                        </div>
                      )}
                      {owner && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <span className="font-medium text-foreground/80">{owner.name}</span>
                          {owner.zone && (
                            <>
                              <span>•</span>
                              <span>{owner.zone}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {owner && <Avatar id={owner.id} size={28} />}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
