import { useMemo, useSyncExternalStore } from "react";
import { createApiListStore } from "./api-list-store";
import { api } from "./api-client";
import type { OneOnOne, OneOnOneActionItem, OneOnOneSentiment } from "@/types/hr";
import { pushNotification, nameOf } from "./notification-store";

function mapOneOnOneFromApi(doc: Record<string, unknown>): OneOnOne {
  const payload = doc.payload as OneOnOne | undefined;
  if (payload) return payload;
  const actionItems = ((doc.actionItems as Array<Record<string, unknown>>) ?? []).map((a) => ({
    id: String(a.id),
    title: String(a.title ?? a.text ?? ""),
    ownerId: String(a.ownerId),
    done: Boolean(a.done),
    dueAt: a.dueAt as number | undefined,
  }));
  return {
    id: String(doc.id),
    managerId: String(doc.managerId),
    reportId: String(doc.reportId),
    scheduledAt: Number(doc.scheduledAt),
    durationMin: Number(doc.durationMin ?? 30),
    status: (doc.status as OneOnOne["status"]) ?? "scheduled",
    sentiment: doc.sentiment as OneOnOneSentiment | undefined,
    agenda: String(doc.agenda ?? ""),
    notes: String(doc.notes ?? ""),
    privateNotes: doc.privateNotes as string | undefined,
    actionItems,
    meetingType: doc.meetingType as "in-person" | "remote" | undefined,
    meetingLink: doc.meetingLink as string | undefined,
    createdAt: Number(doc.createdAt ?? doc.scheduledAt),
    updatedAt: Number(doc.updatedAt ?? doc.scheduledAt),
  };
}

const store = createApiListStore<OneOnOne>({
  legacyKey: "gp_oneonones_v1",
  apiPath: "/one-on-ones",
  seed: [],
});

export async function hydrateOneOnOnes(): Promise<boolean> {
  try {
    const res = await api.get<{ items: Record<string, unknown>[] }>("/one-on-ones");
    if (!res.items?.length) return false;
    const mapped = res.items.map(mapOneOnOneFromApi);
    store.write(mapped);
    return true;
  } catch (err) {
    console.warn("[oneonone] hydrate failed:", err);
    return false;
  }
}

export function useOneOnOnes(): OneOnOne[] {
  const all = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.read(),
    store.getServerSnapshot,
  );
  return useMemo(() => [...all].sort((a, b) => b.scheduledAt - a.scheduledAt), [all]);
}

export function useOneOnOnesFor(personId: string): OneOnOne[] {
  const all = useOneOnOnes();
  return useMemo(
    () => all.filter((o) => o.managerId === personId || o.reportId === personId),
    [all, personId],
  );
}

export function getOneOnOne(id: string): OneOnOne | undefined {
  return store.read().find((o) => o.id === id);
}

export function createOneOnOne(input: {
  managerId: string;
  reportId: string;
  scheduledAt: number;
  durationMin?: number;
  agenda?: string;
  meetingType?: "in-person" | "remote";
  meetingLink?: string;
}): OneOnOne {
  const now = Date.now();
  const next: OneOnOne = {
    id: crypto.randomUUID(),
    managerId: input.managerId,
    reportId: input.reportId,
    scheduledAt: input.scheduledAt,
    durationMin: input.durationMin ?? 30,
    status: "scheduled",
    agenda: input.agenda ?? "",
    notes: "",
    actionItems: [],
    meetingType: input.meetingType,
    meetingLink: input.meetingLink,
    createdAt: now,
    updatedAt: now,
  };
  store.write([next, ...store.read()]);
  pushNotification({
    kind: "calendar",
    toId: input.reportId,
    fromId: input.managerId,
    title: `${nameOf(input.managerId)} scheduled a 1:1 with you`,
    body: new Date(input.scheduledAt).toLocaleString([], {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    actionLabel: "Open",
    actionTo: "/one-on-ones",
  });
  return next;
}

export function updateOneOnOne(id: string, patch: Partial<OneOnOne>) {
  store.write(
    store.read().map((o) => (o.id === id ? { ...o, ...patch, updatedAt: Date.now() } : o)),
  );
}

export function completeOneOnOne(
  id: string,
  sentiment: OneOnOneSentiment,
  notes: string,
  privateNotes: string,
) {
  updateOneOnOne(id, { status: "completed", sentiment, notes, privateNotes });
}

export function addActionItem(id: string, item: Omit<OneOnOneActionItem, "id">) {
  const o = getOneOnOne(id);
  if (!o) return;
  const next: OneOnOneActionItem = { ...item, id: crypto.randomUUID() };
  updateOneOnOne(id, { actionItems: [...o.actionItems, next] });
}

export function toggleActionItem(oneOnOneId: string, itemId: string) {
  const o = getOneOnOne(oneOnOneId);
  if (!o) return;
  updateOneOnOne(oneOnOneId, {
    actionItems: o.actionItems.map((a) => (a.id === itemId ? { ...a, done: !a.done } : a)),
  });
}

export function sentimentColor(s?: OneOnOneSentiment): string {
  switch (s) {
    case "green":
      return "bg-success/15 text-success border-success/30";
    case "amber":
      return "bg-warning/15 text-warning border-warning/30";
    case "red":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
