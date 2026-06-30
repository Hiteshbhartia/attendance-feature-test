import { useMemo, useSyncExternalStore } from "react";
import { createApiListStore } from "./api-list-store";
import type { CalEvent, CalEventType } from "@/types/hr";
import { getRoster } from "@/lib/roster";
import { useTasks } from "./task-store";
import { useLeaves } from "./leave-store";

const store = createApiListStore<CalEvent>({
  legacyKey: "gp_cal_v1",
  apiPath: "/calendar",
  seed: [],
});

export function ensureCalSeed() {
  store.ensureSeed();
}

export function hydrateCalendar() {
  return store.hydrateFromApi();
}

export function useCalendarEvents(): CalEvent[] {
  const base = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.read(),
    store.getServerSnapshot,
  );
  const tasks = useTasks();
  const leaves = useLeaves();

  return useMemo(() => {
    const taskEvents: CalEvent[] = tasks.map((t) => ({
      id: `t-${t.id}`,
      type: "task",
      title: t.title,
      startAt: t.dueAt - 30 * 60_000,
      endAt: t.dueAt,
      ownerId: t.assigneeId,
    }));
    const leaveEvents: CalEvent[] = leaves
      .filter((l) => l.status !== "rejected")
      .map((l) => {
        const start = new Date(l.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(l.endDate);
        end.setHours(23, 59, 0, 0);
        const emp = getRoster().find((e) => e.id === l.employeeId);
        return {
          id: `l-${l.id}`,
          type: "leave",
          title: `${emp?.name ?? "Someone"} on ${l.type} leave`,
          startAt: start.getTime(),
          endAt: end.getTime(),
          ownerId: l.employeeId,
          note: l.reason,
        };
      });
    return [...base, ...taskEvents, ...leaveEvents].sort((a, b) => a.startAt - b.startAt);
  }, [base, tasks, leaves]);
}

export function addCalendarEvent(ev: Omit<CalEvent, "id">) {
  const next: CalEvent = { ...ev, id: crypto.randomUUID() };
  store.write([...store.read(), next]);
  return next;
}

export function eventColor(type: CalEventType): string {
  switch (type) {
    case "shift":
      return "bg-muted text-muted-foreground border-border";
    case "tour":
      return "bg-primary/15 text-primary border-primary/30";
    case "task":
      return "bg-info/15 text-info border-info/30";
    case "leave":
      return "bg-warning/15 text-warning border-warning/30";
    case "holiday":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "birthday":
      return "bg-accent text-accent-foreground border-border";
    case "1:1":
      return "bg-success/15 text-success border-success/30";
    case "town_hall":
      return "bg-primary/15 text-primary border-primary/30";
    case "anniversary":
      return "bg-success/15 text-success border-success/30";
  }
}
