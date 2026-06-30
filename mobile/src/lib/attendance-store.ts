// Attendance event log — localStorage cache + /api/attendance-events sync.
// Each event has a selfie (data URL) + geo coords + reverse-geocoded address.

import { api, apiEnabled, getToken } from "./api-client";
import { DB_FIRST } from "./db-mode";

export type EventKind =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end"
  | "field_start"
  | "field_end";

export interface AttEvent {
  id: string;
  employeeId: string;
  kind: EventKind;
  ts: number; // epoch ms
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  address: string | null;
  selfie: string | null; // data URL
}

export type LiveStatus = "Off" | "Clocked In" | "On Break" | "In Field";

const KEY = "gp_attendance_events_v1";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let cache: AttEvent[] | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync(events: AttEvent[]) {
  if (!apiEnabled || !getToken()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void api
      .post("/attendance-events/bulk-upsert", { items: events })
      .catch((err) => console.warn("[attendance] sync failed:", err));
  }, 600);
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function read(): AttEvent[] {
  if (typeof window === "undefined") return [];
  if (cache) return cache;
  if (DB_FIRST) {
    cache = [];
    return cache;
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    cache = Array.isArray(parsed) ? parsed : [];
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

function write(events: AttEvent[]) {
  cache = events;
  if (!DB_FIRST && typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(events));
    } catch {
      // quota
    }
  }
  emit();
  scheduleSync(events);
}

export async function hydrateAttendance(): Promise<boolean> {
  if (!apiEnabled || !getToken()) return false;
  try {
    const res = await api.get<{ items: AttEvent[] }>("/attendance-events");
    if (res.items?.length) {
      write(res.items);
      return true;
    }
  } catch (err) {
    console.warn("[attendance] hydrate failed:", err);
  }
  return false;
}

export function ensureAttendanceLocal() {
  cache = [];
}

export function getEvents(): AttEvent[] {
  return read();
}

export function getEventsFor(employeeId: string, dayKey?: string): AttEvent[] {
  const all = read().filter((e) => e.employeeId === employeeId);
  if (!dayKey) return all;
  return all.filter((e) => dateKey(e.ts) === dayKey);
}

export function todayKey(ts = Date.now()): string {
  return dateKey(ts);
}

export function dateKey(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function logEvent(ev: Omit<AttEvent, "id" | "ts"> & { ts?: number }) {
  const all = read();
  const next: AttEvent = {
    ...ev,
    id: crypto.randomUUID(),
    ts: ev.ts ?? Date.now(),
  };
  all.push(next);
  write(all);
  return next;
}

export function liveStatusFor(employeeId: string): LiveStatus {
  const evs = getEventsFor(employeeId, todayKey()).sort((a, b) => a.ts - b.ts);
  let status: LiveStatus = "Off";
  for (const e of evs) {
    switch (e.kind) {
      case "clock_in":
        status = "Clocked In";
        break;
      case "clock_out":
        status = "Off";
        break;
      case "break_start":
        status = "On Break";
        break;
      case "break_end":
        status = "Clocked In";
        break;
      case "field_start":
        status = "In Field";
        break;
      case "field_end":
        status = "Clocked In";
        break;
    }
  }
  return status;
}

export function todaySummary(employeeId: string) {
  const evs = getEventsFor(employeeId, todayKey()).sort((a, b) => a.ts - b.ts);
  let workMs = 0;
  let breakMs = 0;
  let fieldMs = 0;
  let workStart: number | null = null;
  let breakStart: number | null = null;
  let fieldStart: number | null = null;
  let firstClockIn: number | null = null;
  let lastClockOut: number | null = null;

  for (const e of evs) {
    if (e.kind === "clock_in") {
      workStart = e.ts;
      if (!firstClockIn) firstClockIn = e.ts;
    } else if (e.kind === "clock_out") {
      if (workStart) {
        workMs += e.ts - workStart;
        workStart = null;
      }
      lastClockOut = e.ts;
    } else if (e.kind === "break_start") {
      if (workStart) {
        workMs += e.ts - workStart;
        workStart = null;
      }
      breakStart = e.ts;
    } else if (e.kind === "break_end") {
      if (breakStart) {
        breakMs += e.ts - breakStart;
        breakStart = null;
      }
      workStart = e.ts;
    } else if (e.kind === "field_start") {
      if (workStart) {
        workMs += e.ts - workStart;
        workStart = null;
      }
      fieldStart = e.ts;
    } else if (e.kind === "field_end") {
      if (fieldStart) {
        fieldMs += e.ts - fieldStart;
        fieldStart = null;
      }
      workStart = e.ts;
    }
  }
  // open intervals: include time up to now
  const now = Date.now();
  if (workStart) workMs += now - workStart;
  if (breakStart) breakMs += now - breakStart;
  if (fieldStart) fieldMs += now - fieldStart;

  return {
    events: evs,
    workMs,
    breakMs,
    fieldMs,
    firstClockIn,
    lastClockOut,
    status: liveStatusFor(employeeId),
  };
}

export function fmtDuration(ms: number) {
  if (ms <= 0) return "0m";
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Geo + reverse-geocode (free, OSM) ----------------------------------------

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
}

export function getGeo(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not available"));
      return;
    }
    
    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Geolocation timeout"));
      }
    }, 10000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1&accept-language=en`,
      { 
        headers: { Accept: "application/json", "Accept-Language": "en-US,en" },
        signal: controller.signal
      },
    );
    clearTimeout(id);
    if (!res.ok) return null;
    const json = await res.json();
    return json.display_name ?? null;
  } catch {
    return null;
  }
}

/** @deprecated Demo attendance is seeded via POST /api/migrate/seed-demo-data */
export function ensureDemoSeed() {
  // no-op (DB-first)
}

// ---------------------------------------------------------------------------
// Historical roster query — fetches attendance events for a specific date
// from the server. Used by the Live Roster date-picker feature.
// ---------------------------------------------------------------------------

export interface RosterEvent {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  employeeTeam: string;
  kind: EventKind;
  ts: number;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  address: string | null;
  selfie: string | null;
}

export async function fetchAttendanceByDate(date: string): Promise<RosterEvent[]> {
  const res = await api.get<{ items: RosterEvent[]; date: string }>(
    `/attendance-events/by-date?date=${encodeURIComponent(date)}`,
  );
  return res.items ?? [];
}

/**
 * Derive a live-style status from a sorted array of events for a single employee.
 * Mirrors liveStatusFor() but works on an arbitrary event array (not today's cache).
 */
export function statusFromEvents(events: AttEvent[] | RosterEvent[]): LiveStatus {
  let status: LiveStatus = "Off";
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  for (const e of sorted) {
    switch (e.kind) {
      case "clock_in":    status = "Clocked In"; break;
      case "clock_out":   status = "Off";        break;
      case "break_start": status = "On Break";   break;
      case "break_end":   status = "Clocked In"; break;
      case "field_start": status = "In Field";   break;
      case "field_end":   status = "Clocked In"; break;
    }
  }
  return status;
}

/**
 * Compute work/break/field durations from an arbitrary event array.
 * Mirrors todaySummary() but works on historical data.
 */
export function summaryFromEvents(events: AttEvent[] | RosterEvent[]) {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  let workMs = 0, breakMs = 0, fieldMs = 0;
  let workStart: number | null = null;
  let breakStart: number | null = null;
  let fieldStart: number | null = null;
  let firstClockIn: number | null = null;
  let lastClockOut: number | null = null;

  for (const e of sorted) {
    if (e.kind === "clock_in") {
      workStart = e.ts;
      if (!firstClockIn) firstClockIn = e.ts;
    } else if (e.kind === "clock_out") {
      if (workStart) { workMs += e.ts - workStart; workStart = null; }
      lastClockOut = e.ts;
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
  // For historical dates, open intervals are closed at the last event ts
  const closeAt = sorted[sorted.length - 1]?.ts ?? Date.now();
  if (workStart)  workMs  += closeAt - workStart;
  if (breakStart) breakMs += closeAt - breakStart;
  if (fieldStart) fieldMs += closeAt - fieldStart;

  return { workMs, breakMs, fieldMs, firstClockIn, lastClockOut };
}
