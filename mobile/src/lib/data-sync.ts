// DB-first boot: seed demo org into MongoDB, then hydrate all stores from API.
import { api, apiEnabled, getCachedUser, getToken } from "./api-client";
import { fetchEmployeeRoster } from "./employees-api";
import { hydrateTasks } from "./task-store";
import { hydrateLeaves } from "./leave-store";
import { hydrateKudos } from "./kudos-store";
import { hydrateCalendar } from "./calendar-store";
import { hydrateConsole } from "./console-store";
import { hydrateFly } from "./fly-store";
import { hydrateAttendance } from "./attendance-store";
import { hydratePulse } from "./pulse-store";
import { hydrateNotifications } from "./notification-store";
import { hydrateOneOnOnes } from "./oneonone-store";
import { hydrateRecruiting } from "./recruiting-store";
import { hydrateZones } from "./zones-store";
import { hydratePlaybooks } from "./playbooks-store";
import { hydrateMessages } from "./message-store";
import { initSocket } from "./socket-client";
import { tierOf } from "./permissions";
import type { Employee } from "@/types/hr";
import type { ApiUser } from "./api-client";

let syncStarted = false;
let syncPromise: Promise<Employee[]> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;

export type SyncArenaResult = {
  employees: Employee[];
};

/**
 * Seed Mongo + hydrate all module stores. Returns fresh employee roster.
 * Safe to call multiple times; only one run in flight.
 */
export async function syncArenaData(user?: ApiUser | null): Promise<SyncArenaResult> {
  if (typeof window === "undefined") return { employees: [] };
  if (!apiEnabled || !getToken()) return { employees: [] };

  if (syncPromise) {
    const employees = await syncPromise;
    return { employees };
  }

  syncStarted = true;
  const u = user ?? getCachedUser();

  syncPromise = (async () => {
    if (!__DEV__) {
      console.debug("[sync] Skipping auto-seed in production mode.");
    }

    let employees: Employee[] = [];
    if (u) {
      employees = await fetchEmployeeRoster(u);
    }

    // Connect to real-time socket
    initSocket();

    // Determine if the current user has recruiting access (leadership, hr, or recruiter tier)
    const me = u?.employeeId ? employees.find((e) => e.id === u.employeeId) : null;
    const tier = me ? tierOf(me) : (u?.role === "admin" ? "leadership" : "teammate");
    const hasRecruiting = ["leadership", "hr", "recruiter"].includes(tier);

    // Phase 1: Critical stores — hydrate these first so the home page renders with real data
    await Promise.all([
      hydrateAttendance(),
      hydrateTasks(),
      hydratePulse(),
      hydrateNotifications(),
    ]);

    // Phase 2: Secondary stores — hydrate in background, UI will reactively update
    Promise.all([
      hydrateLeaves(),
      hydrateKudos(),
      hydrateCalendar(),
      hydrateConsole(),
      hydrateFly(),
      hydrateOneOnOnes(),
      hydrateZones(),
      hydratePlaybooks(),
      hydrateMessages(),
      hasRecruiting ? hydrateRecruiting() : Promise.resolve(false),
    ]).catch((err) => console.warn("[sync] secondary hydrate error:", err));

    return employees;
  })();

  if (!pollInterval && typeof window !== "undefined") {
    pollInterval = setInterval(() => {
      if (apiEnabled && getToken()) {
        const currentUser = getCachedUser();
        if (currentUser) {
          fetchEmployeeRoster(currentUser).catch(console.warn);
        }
        hydrateTasks();
        hydrateNotifications();
        hydrateMessages();
        hydrateKudos();
      }
    }, 5000); // 5 seconds polling for real-time updates
  }

  try {
    const employees = await syncPromise;
    return { employees };
  } finally {
    syncPromise = null;
  }
}

export function resetSyncArenaData() {
  syncStarted = false;
  syncPromise = null;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
