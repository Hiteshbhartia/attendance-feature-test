import { useAuth } from "@/contexts/AuthContext";
import { getRoster } from "@/lib/roster";

/** Org roster from MongoDB (via AuthContext), with registry fallback. */
export function useRoster() {
  const { employees } = useAuth();
  return employees.length > 0 ? employees : getRoster();
}

export function useRosterState() {
  const { employees, status, dataReady, isLoading } = useAuth();
  const roster = employees.length > 0 ? employees : getRoster();
  const loading = isLoading || (status === "authenticated" && !dataReady);
  return {
    roster,
    loading,
    isEmpty: !loading && roster.length === 0,
    ready: dataReady && roster.length > 0,
  };
}

export function useEmployee(id: string | undefined) {
  const roster = useRoster();
  if (!id) return undefined;
  return roster.find((e) => e.id === id);
}
