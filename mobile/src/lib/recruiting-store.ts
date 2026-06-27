import { useMemo, useSyncExternalStore } from "react";
import { createApiListStore } from "./api-list-store";
import { api } from "./api-client";
import type { Candidate, CandidateStage, CandidateNote } from "@/types/hr";
import { pushNotification, nameOf } from "./notification-store";

function mapCandidateFromApi(doc: Record<string, unknown>): Candidate {
  const payload = doc.payload as Candidate | undefined;
  if (payload) return payload;
  return {
    id: String(doc.id),
    name: String(doc.name),
    email: String(doc.email ?? ""),
    phone: String(doc.phone ?? ""),
    roleApplied: (doc.role ?? "Operator") as Candidate["roleApplied"],
    stage: (doc.stage ?? "applied") as CandidateStage,
    source: (doc.source ?? "Inbound") as Candidate["source"],
    rating: 3,
    recruiterId: String(doc.recruiterId ?? ""),
    expectedSalary: 0,
    experience: "",
    city: "",
    appliedAt: Number(doc.appliedAt ?? Date.now()),
    notes: (doc.notes as CandidateNote[]) ?? [],
    rejectReason: doc.rejectReason as string | undefined,
  };
}

const store = createApiListStore<Candidate>({
  legacyKey: "gp_candidates_v1",
  apiPath: "/recruiting",
  seed: [],
});

export async function hydrateRecruiting(): Promise<boolean> {
  try {
    const res = await api.get<{ items: Record<string, unknown>[] }>("/recruiting");
    if (!res.items?.length) return false;
    store.write(res.items.map(mapCandidateFromApi));
    return true;
  } catch (err) {
    console.warn("[recruiting] hydrate failed:", err);
    return false;
  }
}

export function useCandidates(): Candidate[] {
  const all = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.read(),
    store.getServerSnapshot,
  );
  return useMemo(() => [...all].sort((a, b) => b.appliedAt - a.appliedAt), [all]);
}

export function getCandidate(id: string): Candidate | undefined {
  return store.read().find((c) => c.id === id);
}

export function moveCandidate(id: string, toStage: CandidateStage, byId: string) {
  const cand = getCandidate(id);
  if (!cand) return;
  const fromStage = cand.stage;
  store.write(store.read().map((c) => (c.id === id ? { ...c, stage: toStage } : c)));
  if (fromStage !== toStage) {
    pushNotification({
      kind: "system",
      toId: cand.recruiterId,
      fromId: byId,
      title: `${cand.name} moved to ${toStage}`,
      body: `${nameOf(byId)} updated stage from ${fromStage} → ${toStage}`,
      actionLabel: "Open",
      actionTo: "/recruiting",
    });
  }
}

export function addCandidate(
  input: Omit<Candidate, "id" | "appliedAt" | "notes" | "stage"> & { stage?: CandidateStage },
) {
  const next: Candidate = {
    ...input,
    id: crypto.randomUUID(),
    appliedAt: Date.now(),
    stage: input.stage ?? "applied",
    notes: [],
  };
  store.write([next, ...store.read()]);
  return next;
}

export function updateCandidate(id: string, patch: Partial<Candidate>) {
  store.write(store.read().map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

export function addCandidateNote(id: string, authorId: string, body: string) {
  const cand = getCandidate(id);
  if (!cand) return;
  const note: CandidateNote = {
    id: crypto.randomUUID(),
    authorId,
    body,
    ts: Date.now(),
  };
  updateCandidate(id, { notes: [note, ...cand.notes] });
}

export function rejectCandidate(id: string, reason: string, byId: string) {
  updateCandidate(id, { stage: "rejected", rejectReason: reason });
  const cand = getCandidate(id);
  if (cand) {
    pushNotification({
      kind: "system",
      toId: cand.recruiterId,
      fromId: byId,
      title: `${cand.name} rejected`,
      body: reason,
      actionLabel: "Open",
      actionTo: "/recruiting",
    });
  }
}

export function stageColor(stage: CandidateStage): string {
  switch (stage) {
    case "applied":
      return "bg-muted text-muted-foreground border-border";
    case "screen":
      return "bg-info/15 text-info border-info/30";
    case "interview":
      return "bg-primary/15 text-primary border-primary/30";
    case "offer":
      return "bg-warning/15 text-warning border-warning/30";
    case "hired":
      return "bg-success/15 text-success border-success/30";
    case "rejected":
      return "bg-destructive/10 text-destructive border-destructive/20";
  }
}

export function pipelineStats() {
  const all = store.read();
  const byStage = (s: CandidateStage) => all.filter((c) => c.stage === s).length;
  const active = all.filter((c) => c.stage !== "hired" && c.stage !== "rejected");
  const hiredLast30 = all.filter(
    (c) => c.stage === "hired" && c.appliedAt > Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).length;
  const offerToHire =
    byStage("offer") + byStage("hired") === 0
      ? 0
      : Math.round((byStage("hired") / (byStage("offer") + byStage("hired"))) * 100);
  return {
    total: all.length,
    active: active.length,
    applied: byStage("applied"),
    screen: byStage("screen"),
    interview: byStage("interview"),
    offer: byStage("offer"),
    hired: byStage("hired"),
    rejected: byStage("rejected"),
    hiredLast30,
    offerToHire,
  };
}
