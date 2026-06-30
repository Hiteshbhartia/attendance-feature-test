import { useMemo, useSyncExternalStore } from "react";
import { createApiListStore } from "./api-list-store";
import type { Kudo, KudoTag } from "@/types/hr";
import { pushNotification, nameOf } from "./notification-store";

const store = createApiListStore<Kudo>({
  legacyKey: "gp_kudos_v1",
  apiPath: "/kudos",
  seed: [],
});

export function ensureKudosSeed() {
  store.ensureSeed();
}

export function hydrateKudos() {
  return store.hydrateFromApi();
}

export function useKudos(): Kudo[] {
  const all = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.read(),
    store.getServerSnapshot,
  );
  return useMemo(() => [...all].sort((a, b) => b.ts - a.ts), [all]);
}

export function kudosReceived(toId: string, sinceMs?: number): Kudo[] {
  const cutoff = sinceMs ?? 0;
  return store.read().filter((k) => k.toId === toId && k.ts >= cutoff);
}

export function giveKudo(fromId: string, toId: string, tag: KudoTag, message: string) {
  const next: Kudo = {
    id: crypto.randomUUID(),
    fromId,
    toId,
    tag,
    message,
    ts: Date.now(),
  };
  store.write([next, ...store.read()]);
  pushNotification({
    kind: "kudos",
    toId,
    fromId,
    title: `${nameOf(fromId)} sent you a kudo`,
    body: `${tag} — '${message}'`,
    actionLabel: "Open",
    actionTo: "/kudos",
  });
  return next;
}

export const KUDO_TAGS: KudoTag[] = [
  "Hustle",
  "Customer Love",
  "Team Player",
  "Above & Beyond",
  "Bug Fixer",
  "Streak Hero",
];

export function tagColor(tag: KudoTag): string {
  switch (tag) {
    case "Hustle":
      return "bg-primary/15 text-primary border-primary/30";
    case "Customer Love":
      return "bg-warning/15 text-warning border-warning/30";
    case "Team Player":
      return "bg-info/15 text-info border-info/30";
    case "Above & Beyond":
      return "bg-success/15 text-success border-success/30";
    case "Bug Fixer":
      return "bg-accent text-accent-foreground border-border";
    case "Streak Hero":
      return "bg-destructive/10 text-destructive border-destructive/20";
  }
}
