import { useSyncExternalStore } from "react";
import { makeStore } from "./store";
import { api } from "./api-client";

export type PlaybookKey = string;
export type RolePlaybook = any;

interface PlaybooksState {
  playbooks: Record<string, any>;
  hydrated: boolean;
}

const SEED: PlaybooksState = { playbooks: {}, hydrated: false };

const store = makeStore<PlaybooksState>("gp_playbooks_v1", SEED);

export function usePlaybookStore() {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.read(),
    store.getServerSnapshot
  );
}

export async function hydratePlaybooks() {
  try {
    const res: any[] = await api.get("/playbooks");
    const map: Record<string, any> = {};
    res.forEach((p: any) => map[p.id] = p);
    store.write({ playbooks: map, hydrated: true });
    return true;
  } catch (err) {
    console.error("[hydrate] playbooks failed:", err);
    return false;
  }
}

export function playbookFor(key: string) {
  const { playbooks } = store.read();
  return playbooks[key] || {
    id: key,
    title: "Playbook " + key,
    steps: [],
    shieldBlocks: [],
    sprints: [],
    commWindows: [],
    kpis: [],
    eodFields: []
  };
}

export function nowMin() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

export { store as playbookStore };
