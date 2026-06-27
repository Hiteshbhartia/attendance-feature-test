// Core Arena event spine.
// Every meaningful action emits one event. Subscribers (notifications,
// escalation, mission brief, audit) react. Persisted to localStorage so the
// timeline survives reloads.

import { useSyncExternalStore, useMemo } from "react";
import { makeStore } from "./store";
import { type Employee } from "@/types/hr";
import { getRoster } from "@/lib/roster";

export type ArenaEventKind =
  | "blocker.raised"
  | "blocker.cleared"
  | "task.created"
  | "task.breach"
  | "task.done"
  | "partner.ticket.opened"
  | "partner.ticket.resolved"
  | "leave.requested"
  | "leave.approved"
  | "recruit.hired"
  | "kudos.given"
  | "attendance.late"
  | "ops.escalated";

export interface ArenaEvent {
  id: string;
  kind: ArenaEventKind;
  actorId: string; // who did it
  targetId?: string; // who it's about / who owns the follow-up
  zone?: string;
  property?: string;
  title: string;
  body?: string;
  ts: number;
  // Routing hints
  deeplink?: string;
  severity?: "low" | "med" | "high" | "urgent";
  meta?: Record<string, string | number | boolean>;
}

const store = makeStore<ArenaEvent[]>("ca_events_v1", []);

export function useEvents(filter?: (e: ArenaEvent) => boolean): ArenaEvent[] {
  const all = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.read(),
    store.getServerSnapshot,
  );
  return useMemo(() => {
    const list = filter ? all.filter(filter) : all;
    return [...list].sort((a, b) => b.ts - a.ts);
  }, [all, filter]);
}

export function emit(input: Omit<ArenaEvent, "id" | "ts"> & { ts?: number }): ArenaEvent {
  const evt: ArenaEvent = {
    ...input,
    id: crypto.randomUUID(),
    ts: input.ts ?? Date.now(),
  };
  store.write([evt, ...store.read()].slice(0, 500));
  return evt;
}

export function recentEvents(n = 50): ArenaEvent[] {
  return store.read().slice(0, n);
}

// ---------- Chain resolver ----------
// Walks managerId up the org. Used by escalation paths.
export function chainOf(employeeId: string): Employee[] {
  const chain: Employee[] = [];
  let cur = getRoster().find((e) => e.id === employeeId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    chain.push(cur);
    seen.add(cur.id);
    cur = cur.managerId ? getRoster().find((e) => e.id === cur!.managerId) : undefined;
  }
  return chain;
}

export function managerOf(employeeId: string): Employee | undefined {
  const me = getRoster().find((e) => e.id === employeeId);
  return me?.managerId ? getRoster().find((e) => e.id === me.managerId) : undefined;
}

export function zoneLeaderFor(zone?: string): Employee | undefined {
  if (!zone) return undefined;
  return getRoster().find((e) => e.role === "Zone Leader" && e.zone === zone);
}
