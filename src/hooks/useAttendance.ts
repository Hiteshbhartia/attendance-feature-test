import { useEffect, useState, useSyncExternalStore } from "react";
import { AttEvent, getEvents, subscribe } from "@/lib/attendance-store";
import { useAuth } from "@/contexts/AuthContext";
import type { Employee } from "@/types/hr";

function snapshot(actorId: string) {
  return JSON.stringify({
    a: actorId,
    n: getEvents().length,
    t: getEvents()[getEvents().length - 1]?.ts,
  });
}

const PLACEHOLDER: Employee = {
  id: "loading",
  name: "…",
  role: "Operator",
  appRole: "employee",
  experience: "Mid",
  attendance: 0,
  performance: 0,
  consistency: 0,
  revenueImpact: 0,
  taskCompletion: 0,
  conversion: 0,
  callsToday: 0,
  callTarget: 0,
  leadsActive: 0,
  closedDeals: 0,
  lostDeals: 0,
  flags: [],
  status: "Offline",
  streakDays: 0,
  team: "HQ",
  shift: "10:00 - 19:00",
  avatarSeed: "User",
};

/** Attendance events + authenticated actor (from API session). */
export function useAttendanceState() {
  const { actor, employees, status: authStatus } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const actorId = actor?.id ?? "loading";
  const version = useSyncExternalStore(
    (cb) => subscribe(cb),
    () => snapshot(actorId),
    () => "ssr",
  );

  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  void version;

  const resolvedActor = actor ?? PLACEHOLDER;
  const ready = mounted && authStatus === "authenticated" && actor != null;

  if (!mounted || !ready) {
    return {
      actor: PLACEHOLDER,
      actorId: PLACEHOLDER.id,
      events: [] as AttEvent[],
      employees: employees.length ? employees : [PLACEHOLDER],
    };
  }

  return {
    actor: resolvedActor,
    actorId: resolvedActor.id,
    events: getEvents() as AttEvent[],
    employees,
  };
}
