// Gharpayy Fly — daily execution board stores
// All localStorage-backed via shared makeStore helper.

import { useSyncExternalStore, useMemo } from "react";
import { createApiListStore } from "./api-list-store";
import { getRoster } from "@/lib/roster";
import { emit, managerOf, zoneLeaderFor } from "./event-bus";
import { createTask } from "./task-store";
import { pushNotification, nameOf } from "./notification-store";

// ---------- Types ----------

export type DailyUpdate = {
  id: string;
  authorId: string;
  date: string; // YYYY-MM-DD
  connectedCalls: number;
  visitsScheduled: number;
  visitsCompleted: number;
  hotLeads: number;
  bookings: number;
  blocker: string;
  propertyIssue: string;
  tomorrowPriority: string;
  zone: string;
  createdAt: number;
};

export type RetroKind = "start" | "stop" | "continue";

export type RetroItem = {
  id: string;
  kind: RetroKind;
  authorId: string;
  body: string;
  createdAt: number;
  upvotes: string[]; // employee ids
  comments: { id: string; authorId: string; body: string; ts: number }[];
};

export type FeedKind =
  | "visit"
  | "lead"
  | "blocker"
  | "callback"
  | "booking"
  | "issue"
  | "win"
  | "system"
  | "tour";

export type FeedEvent = {
  id: string;
  kind: FeedKind;
  authorId: string;
  zone?: string;
  property?: string;
  body: string;
  ts: number;
  upvotes: string[];
  comments: { id: string; authorId: string; body: string; ts: number }[];
};

// ---------- Seed ----------

const today = () => new Date().toISOString().slice(0, 10);
const hoursAgo = (h: number) => Date.now() - h * 3600 * 1000;

const SEED_UPDATES: DailyUpdate[] = [
  {
    id: "u1",
    authorId: "e3",
    date: today(),
    connectedCalls: 22,
    visitsScheduled: 6,
    visitsCompleted: 4,
    hotLeads: 3,
    bookings: 1,
    blocker: "Owner not picking up at Brook Luxe — token pending",
    propertyIssue: "WiFi flaky at Aeris Boys block B",
    tomorrowPriority: "Close Brook Luxe token + visit 2 Whitefield parents",
    zone: "Whitefield",
    createdAt: hoursAgo(2),
  },
  {
    id: "u2",
    authorId: "e6",
    date: today(),
    connectedCalls: 0,
    visitsScheduled: 5,
    visitsCompleted: 5,
    hotLeads: 2,
    bookings: 0,
    blocker: "Cab cancelled for 4pm slot, rebooked but visit slipped 40m",
    propertyIssue: "Geyser dead at Oryn Girls room 304",
    tomorrowPriority: "First batch of 3 morning tours back-to-back",
    zone: "Bandra",
    createdAt: hoursAgo(3),
  },
  {
    id: "u3",
    authorId: "e7",
    date: today(),
    connectedCalls: 31,
    visitsScheduled: 4,
    visitsCompleted: 3,
    hotLeads: 4,
    bookings: 2,
    blocker: "Two parents want callback after 9pm — outside shift",
    propertyIssue: "",
    tomorrowPriority: "Parent callbacks 9–10pm + reassign cold leads",
    zone: "Andheri",
    createdAt: hoursAgo(1),
  },
  {
    id: "u4",
    authorId: "e5",
    date: today(),
    connectedCalls: 12,
    visitsScheduled: 2,
    visitsCompleted: 1,
    hotLeads: 1,
    bookings: 0,
    blocker: "Struggling with parent objections on deposit",
    propertyIssue: "",
    tomorrowPriority: "Shadow Karan on 3 calls + reattempt Bellandur lead",
    zone: "Andheri",
    createdAt: hoursAgo(5),
  },
];

const SEED_RETRO: RetroItem[] = [
  {
    id: "r1",
    kind: "start",
    authorId: "e2",
    body: "Faster parent callbacks — within 15 min of enquiry",
    createdAt: hoursAgo(20),
    upvotes: ["e3", "e6", "e7", "e4"],
    comments: [
      { id: "rc1", authorId: "e4", body: "Agreed. Will set SLA timer.", ts: hoursAgo(18) },
    ],
  },
  {
    id: "r2",
    kind: "start",
    authorId: "e4",
    body: "Evening 7–9pm follow-up batch for working parents",
    createdAt: hoursAgo(15),
    upvotes: ["e2", "e3"],
    comments: [],
  },
  {
    id: "r3",
    kind: "stop",
    authorId: "e6",
    body: "Delayed visit confirmations — losing 1 in 4",
    createdAt: hoursAgo(22),
    upvotes: ["e2", "e3", "e5", "e7", "e4"],
    comments: [
      {
        id: "rc2",
        authorId: "e2",
        body: "Confirm within 30 min, no exceptions.",
        ts: hoursAgo(21),
      },
    ],
  },
  {
    id: "r4",
    kind: "stop",
    authorId: "e7",
    body: "Showing rooms that are already booked / on hold",
    createdAt: hoursAgo(10),
    upvotes: ["e6", "e2", "e5"],
    comments: [],
  },
  {
    id: "r5",
    kind: "continue",
    authorId: "e2",
    body: "Brook Luxe conversion script — 38% close rate this week",
    createdAt: hoursAgo(12),
    upvotes: ["e3", "e7", "e4", "e6"],
    comments: [],
  },
  {
    id: "r6",
    kind: "continue",
    authorId: "e3",
    body: "Quick WhatsApp follow-up with photos within 5 min of visit",
    createdAt: hoursAgo(8),
    upvotes: ["e6", "e7"],
    comments: [],
  },
];

const SEED_FEED: FeedEvent[] = [
  {
    id: "f1",
    kind: "visit",
    authorId: "e6",
    zone: "Whitefield",
    property: "Brook Luxe",
    body: "3 visits completed at Brook Luxe — 2 strong intents",
    ts: hoursAgo(1.5),
    upvotes: ["e2", "e7"],
    comments: [],
  },
  {
    id: "f2",
    kind: "lead",
    authorId: "e3",
    zone: "Whitefield",
    property: "Brook Luxe",
    body: "Hot lead pending token — parent wants call before EOD",
    ts: hoursAgo(2),
    upvotes: ["e2"],
    comments: [
      { id: "fc1", authorId: "e2", body: "Take it. I'll back you up.", ts: hoursAgo(1.8) },
    ],
  },
  {
    id: "f3",
    kind: "issue",
    authorId: "e6",
    zone: "Bandra",
    property: "Aeris Boys",
    body: "WiFi issue raised at Aeris Boys — 6 tenants complaining",
    ts: hoursAgo(3),
    upvotes: ["e4", "e2", "e7", "e3"],
    comments: [],
  },
  {
    id: "f4",
    kind: "callback",
    authorId: "e7",
    zone: "Andheri",
    property: "Bellandur Hub",
    body: "Parent callback requested for Bellandur lead",
    ts: hoursAgo(0.5),
    upvotes: [],
    comments: [],
  },
  {
    id: "f5",
    kind: "booking",
    authorId: "e7",
    zone: "Andheri",
    property: "Aeris Boys",
    body: "Booking confirmed — token received ₹15k",
    ts: hoursAgo(4),
    upvotes: ["e2", "e4", "e6", "e3", "e5"],
    comments: [],
  },
  {
    id: "f6",
    kind: "win",
    authorId: "e2",
    zone: "All",
    body: "Team crossed 12 visits before lunch — best Tuesday this month",
    ts: hoursAgo(5),
    upvotes: ["e3", "e7", "e6", "e4", "e5"],
    comments: [],
  },
  {
    id: "f7",
    kind: "blocker",
    authorId: "e5",
    zone: "Andheri",
    body: "Stuck on deposit objection on 2 calls back-to-back — need script help",
    ts: hoursAgo(6),
    upvotes: ["e2"],
    comments: [
      {
        id: "fc2",
        authorId: "e2",
        body: "Use the 'split-pay' line. I'll DM the script.",
        ts: hoursAgo(5.5),
      },
    ],
  },
];

const updateStore = createApiListStore<DailyUpdate>({
  legacyKey: "gp_fly_updates_v1",
  apiPath: "/fly/updates",
  seed: [],
});
const retroStore = createApiListStore<RetroItem>({
  legacyKey: "gp_fly_retro_v1",
  apiPath: "/fly/retro",
  seed: [],
});
const feedStore = createApiListStore<FeedEvent>({
  legacyKey: "gp_fly_feed_v1",
  apiPath: "/fly/feed",
  seed: [],
});

export function ensureFlySeed() {
  updateStore.ensureSeed();
  retroStore.ensureSeed();
  feedStore.ensureSeed();
}

export async function hydrateFly() {
  await Promise.all([
    updateStore.hydrateFromApi(),
    retroStore.hydrateFromApi(),
    feedStore.hydrateFromApi(),
  ]);
}

// ---------- Hooks ----------

export function useDailyUpdates(): DailyUpdate[] {
  const all = useSyncExternalStore(
    (cb) => updateStore.subscribe(cb),
    () => updateStore.read(),
    updateStore.getServerSnapshot,
  );
  return useMemo(() => [...all].sort((a, b) => b.createdAt - a.createdAt), [all]);
}

export function useRetroItems(): RetroItem[] {
  const all = useSyncExternalStore(
    (cb) => retroStore.subscribe(cb),
    () => retroStore.read(),
    retroStore.getServerSnapshot,
  );
  return useMemo(
    () => [...all].sort((a, b) => b.upvotes.length - a.upvotes.length || b.createdAt - a.createdAt),
    [all],
  );
}

export function useFeed(): FeedEvent[] {
  const all = useSyncExternalStore(
    (cb) => feedStore.subscribe(cb),
    () => feedStore.read(),
    feedStore.getServerSnapshot,
  );
  return useMemo(() => [...all].sort((a, b) => b.ts - a.ts), [all]);
}

// ---------- Daily updates ----------

export function submitDailyUpdate(
  input: Omit<DailyUpdate, "id" | "createdAt" | "date"> & { date?: string },
): DailyUpdate {
  const next: DailyUpdate = {
    ...input,
    id: crypto.randomUUID(),
    date: input.date ?? today(),
    createdAt: Date.now(),
  };
  updateStore.write([next, ...updateStore.read()]);

  // mirror as feed events
  const author = getRoster().find((e) => e.id === input.authorId);
  const zone = input.zone || author?.zone || "All";
  const events: FeedEvent[] = [];
  if (input.visitsCompleted > 0) {
    events.push(
      mkFeed({
        kind: "visit",
        authorId: input.authorId,
        zone,
        body: `${input.visitsCompleted} visits completed in ${zone}`,
      }),
    );
  }
  if (input.hotLeads > 0) {
    events.push(
      mkFeed({
        kind: "lead",
        authorId: input.authorId,
        zone,
        body: `${input.hotLeads} hot lead${input.hotLeads > 1 ? "s" : ""} flagged`,
      }),
    );
  }
  if (input.bookings > 0) {
    events.push(
      mkFeed({
        kind: "booking",
        authorId: input.authorId,
        zone,
        body: `${input.bookings} booking${input.bookings > 1 ? "s" : ""} closed today`,
      }),
    );
  }
  if (input.blocker.trim()) {
    events.push(
      mkFeed({ kind: "blocker", authorId: input.authorId, zone, body: input.blocker.trim() }),
    );
  }
  if (input.propertyIssue.trim()) {
    events.push(
      mkFeed({
        kind: "issue",
        authorId: input.authorId,
        zone,
        property: input.propertyIssue.split(" ")[0],
        body: input.propertyIssue.trim(),
      }),
    );
  }
  if (events.length) feedStore.write([...events, ...feedStore.read()]);

  // --- 10x: escalate blockers into the event spine + auto-create an action item ---
  if (input.blocker.trim()) {
    const blockerText = input.blocker.trim();
    const mgr = managerOf(input.authorId);
    const zl = zoneLeaderFor(zone);
    const owner = mgr ?? zl ?? getRoster().find((e) => e.id === input.authorId)!;

    emit({
      kind: "blocker.raised",
      actorId: input.authorId,
      targetId: owner.id,
      zone,
      title: blockerText.slice(0, 80),
      body: `Raised by ${nameOf(input.authorId)} · ${zone}`,
      severity: "high",
      deeplink: "/fly",
    });

    createTask({
      title: `Unblock: ${blockerText.slice(0, 60)}`,
      description: `Auto-created from Fly daily update by ${nameOf(input.authorId)}.\n\nBlocker:\n${blockerText}`,
      assigneeId: owner.id,
      assignedById: input.authorId,
      priority: "urgent",
      dueAt: Date.now() + 2 * 3600_000,
      relatedTo: `Blocker · ${zone}`,
      source: "auto",
    });

    if (zl && zl.id !== owner.id) {
      pushNotification({
        kind: "system",
        toId: zl.id,
        fromId: input.authorId,
        title: `Blocker raised in ${zone}`,
        body: blockerText,
        actionLabel: "Open Fly",
        actionTo: "/fly",
      });
    }
  }

  if (input.propertyIssue.trim()) {
    emit({
      kind: "partner.ticket.opened",
      actorId: input.authorId,
      zone,
      title: input.propertyIssue.trim().slice(0, 80),
      body: `Operator-flagged property issue · ${zone}`,
      severity: "med",
      deeplink: "/partner",
    });
  }

  return next;
}

function mkFeed(input: Omit<FeedEvent, "id" | "ts" | "upvotes" | "comments">): FeedEvent {
  return { ...input, id: crypto.randomUUID(), ts: Date.now(), upvotes: [], comments: [] };
}

export function todayUpdateFor(authorId: string): DailyUpdate | undefined {
  const d = today();
  return updateStore.read().find((u) => u.authorId === authorId && u.date === d);
}

// ---------- Retro ----------

export function addRetro(kind: RetroKind, authorId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const next: RetroItem = {
    id: crypto.randomUUID(),
    kind,
    authorId,
    body: text,
    createdAt: Date.now(),
    upvotes: [],
    comments: [],
  };
  retroStore.write([next, ...retroStore.read()]);
}

export function toggleRetroUpvote(id: string, employeeId: string) {
  retroStore.write(
    retroStore.read().map((r) => {
      if (r.id !== id) return r;
      const has = r.upvotes.includes(employeeId);
      return {
        ...r,
        upvotes: has ? r.upvotes.filter((u) => u !== employeeId) : [...r.upvotes, employeeId],
      };
    }),
  );
}

export function addRetroComment(id: string, authorId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const list = retroStore.read();
  const next = list.map((r) => {
    if (r.id !== id) return r;
    return {
      ...r,
      comments: [...r.comments, { id: crypto.randomUUID(), authorId, body: text, ts: Date.now() }],
    };
  });
  retroStore.write(next);
}

// ---------- Feed ----------

export function postFeed(input: Omit<FeedEvent, "id" | "ts" | "upvotes" | "comments">) {
  feedStore.write([mkFeed(input), ...feedStore.read()]);
}

export function toggleFeedUpvote(id: string, employeeId: string) {
  feedStore.write(
    feedStore.read().map((f) => {
      if (f.id !== id) return f;
      const has = f.upvotes.includes(employeeId);
      return {
        ...f,
        upvotes: has ? f.upvotes.filter((u) => u !== employeeId) : [...f.upvotes, employeeId],
      };
    }),
  );
}

export function addFeedComment(id: string, authorId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const list = feedStore.read();
  const next = list.map((f) => {
    if (f.id !== id) return f;
    return {
      ...f,
      comments: [...f.comments, { id: crypto.randomUUID(), authorId, body: text, ts: Date.now() }],
    };
  });
  feedStore.write(next);
}

// ---------- Leadership rollups ----------

export type ZoneStat = {
  zone: string;
  calls: number;
  visitsScheduled: number;
  visitsCompleted: number;
  hotLeads: number;
  bookings: number;
  blockers: number;
  contributors: number;
  topPerformerId?: string;
};

export function todayRollup() {
  const d = today();
  const updates = updateStore.read().filter((u) => u.date === d);
  const totals = updates.reduce(
    (acc, u) => ({
      calls: acc.calls + u.connectedCalls,
      visitsScheduled: acc.visitsScheduled + u.visitsScheduled,
      visitsCompleted: acc.visitsCompleted + u.visitsCompleted,
      hotLeads: acc.hotLeads + u.hotLeads,
      bookings: acc.bookings + u.bookings,
      blockers: acc.blockers + ((typeof u.blocker === 'string' ? u.blocker : "").trim() ? 1 : 0),
    }),
    { calls: 0, visitsScheduled: 0, visitsCompleted: 0, hotLeads: 0, bookings: 0, blockers: 0 },
  );

  const byZone = new Map<string, ZoneStat>();
  for (const u of updates) {
    const z = u.zone || "Unzoned";
    const cur = byZone.get(z) ?? {
      zone: z,
      calls: 0,
      visitsScheduled: 0,
      visitsCompleted: 0,
      hotLeads: 0,
      bookings: 0,
      blockers: 0,
      contributors: 0,
    };
    cur.calls += u.connectedCalls;
    cur.visitsScheduled += u.visitsScheduled;
    cur.visitsCompleted += u.visitsCompleted;
    cur.hotLeads += u.hotLeads;
    cur.bookings += u.bookings;
    cur.blockers += (typeof u.blocker === 'string' ? u.blocker : "").trim() ? 1 : 0;
    cur.contributors += 1;
    byZone.set(z, cur);
  }
  const zones = [...byZone.values()].sort(
    (a, b) => b.bookings - a.bookings || b.visitsCompleted - a.visitsCompleted,
  );

  // Score per contributor for "top performer"
  const scored = updates.map((u) => ({
    id: u.authorId,
    score: u.bookings * 50 + u.hotLeads * 15 + u.visitsCompleted * 10 + u.connectedCalls,
  }));
  scored.sort((a, b) => b.score - a.score);
  const topPerformerId = scored[0]?.id;

  return {
    totals,
    zones,
    topPerformerId,
    submissions: updates.length,
    teamSize: getRoster().filter((e) => e.appRole !== "admin").length,
  };
}

export function getRawStores() {
  return {
    updates: updateStore.read(),
    retro: retroStore.read(),
    feed: feedStore.read(),
  };
}
