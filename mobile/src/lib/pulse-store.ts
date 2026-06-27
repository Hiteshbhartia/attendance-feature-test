// Gharpayy Pulse — 3 slot updates + EOD per teammate per day.
// Source of truth: MongoDB via /api/pulse (localStorage cache as fallback).
import { getRoster } from "@/lib/roster";
import { createApiListStore } from "./api-list-store";

export type SlotKey = "slot1" | "slot2" | "slot3" | "eod";

export interface SlotDef {
  key: SlotKey;
  label: string;
  window: string;
  startMin: number;
  endMin: number;
  prompt: string;
}

export const SLOTS: SlotDef[] = [
  {
    key: "slot1",
    label: "Slot 1 · Morning Pulse",
    window: "10:30 – 1:15",
    startMin: 10 * 60 + 30,
    endMin: 13 * 60 + 15,
    prompt: "What did you ship between 10:30 and 1:15? Calls, tours, follow-ups, blockers.",
  },
  {
    key: "slot2",
    label: "Slot 2 · Afternoon Pulse",
    window: "2:00 – 5:00",
    startMin: 14 * 60,
    endMin: 17 * 60,
    prompt: "What moved between 2:00 and 5:00? Closures, escalations, on-ground wins.",
  },
  {
    key: "slot3",
    label: "Slot 3 · Evening Pulse",
    window: "5:20 – 8:00",
    startMin: 17 * 60 + 20,
    endMin: 20 * 60,
    prompt: "Final stretch 5:20 – 8:00. Conversions, callbacks set for tomorrow, tickets cleared.",
  },
  {
    key: "eod",
    label: "End of Day Brief",
    window: "By 8:30",
    startMin: 0,
    endMin: 20 * 60 + 30,
    prompt: "EOD: numbers for the day, what you closed, what's pending, what you need help on.",
  },
];

export interface PulseEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  team: string;
  zone?: string;
  date: string;
  slot: SlotKey;
  text: string;
  calls?: number;
  tours?: number;
  closures?: number;
  blockers?: string;
  mediaUrls?: string[]; // Array of Proof of work base64 images
  submittedAt: number;
  onTime: boolean;
  isPending?: boolean;
}

const store = createApiListStore<PulseEntry>({
  legacyKey: "gharpayy.pulse.v1",
  apiPath: "/pulse",
  seed: [],
});

function load(): PulseEntry[] {
  return store.read();
}

function save(rows: PulseEntry[]) {
  store.write(rows);
}

export function hydratePulse() {
  return store.hydrateFromApi();
}

export function flushPulseSync() {
  return store.flushSync();
}

export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function activeSlot(d = new Date()): SlotDef | null {
  const m = nowMinutes(d);
  for (const s of SLOTS) {
    if (s.key === "eod") continue;
    if (m >= s.startMin && m <= s.endMin) return s;
  }
  if (m > SLOTS[2].endMin) return SLOTS[3];
  return null;
}

export function getEntries(filter?: {
  employeeId?: string;
  date?: string;
  slot?: SlotKey;
}): PulseEntry[] {
  let rows = load();
  if (filter?.employeeId) rows = rows.filter((r) => r.employeeId === filter.employeeId);
  if (filter?.date) rows = rows.filter((r) => r.date === filter.date);
  if (filter?.slot) rows = rows.filter((r) => r.slot === filter.slot);
  return rows.sort((a, b) => b.submittedAt - a.submittedAt);
}

export function submitPulse(input: {
  employeeId: string;
  slot: SlotKey;
  text: string;
  calls?: number;
  tours?: number;
  closures?: number;
  blockers?: string;
  mediaUrls?: string[];
}): PulseEntry {
  const emp = getRoster().find((e) => e.id === input.employeeId);
  const date = todayISO();
  const rows = load();
  const existingIdx = rows.findIndex(
    (r) => r.employeeId === input.employeeId && r.date === date && r.slot === input.slot,
  );
  const slotDef = SLOTS.find((s) => s.key === input.slot)!;
  const m = nowMinutes();
  const onTime = input.slot === "eod" ? m <= 20 * 60 + 30 : m <= slotDef.endMin + 15;
  const entry: PulseEntry = {
    id:
      existingIdx >= 0
        ? rows[existingIdx].id
        : `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    employeeId: input.employeeId,
    employeeName: emp?.name || "Unknown",
    role: emp?.role || "—",
    team: emp?.team || "—",
    zone: emp?.zone,
    date,
    slot: input.slot,
    text: input.text.trim(),
    calls: input.calls,
    tours: input.tours,
    closures: input.closures,
    blockers: input.blockers?.trim() || undefined,
    mediaUrls: input.mediaUrls?.length ? input.mediaUrls : ((input as any).mediaUrl ? [(input as any).mediaUrl] : undefined),
    submittedAt: Date.now(),
    onTime,
  };
  if (existingIdx >= 0) rows[existingIdx] = entry;
  else rows.unshift(entry);
  save(rows);
  return entry;
}

export function complianceFor(
  employeeId: string,
  date = todayISO(),
): { done: SlotKey[]; missing: SlotKey[] } {
  const rows = getEntries({ employeeId, date });
  const done = rows.map((r) => r.slot);
  const missing = SLOTS.map((s) => s.key).filter((k) => !done.includes(k));
  return { done, missing };
}

export function orgComplianceToday(): {
  employeeId: string;
  name: string;
  team: string;
  role: string;
  done: SlotKey[];
  missing: SlotKey[];
  rate: number;
}[] {
  const date = todayISO();
  return getRoster()
    .filter((e) => e.role !== "Property Partner")
    .map((e) => {
      const c = complianceFor(e.id, date);
      const m = nowMinutes();
      const expected = SLOTS.filter((s) => m >= s.endMin || (s.key === "eod" && m >= 20 * 60)).map(
        (s) => s.key,
      );
      const expectedDone = expected.filter((k) => c.done.includes(k)).length;
      const rate = expected.length ? Math.round((expectedDone / expected.length) * 100) : 100;
      return {
        employeeId: e.id,
        name: e.name,
        team: e.team,
        role: e.role,
        done: c.done,
        missing: c.missing,
        rate,
      };
    })
    .sort((a, b) => a.rate - b.rate);
}

export function subscribe(cb: () => void): () => void {
  return store.subscribe(cb);
}
