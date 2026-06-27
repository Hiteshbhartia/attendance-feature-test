import type { Employee } from "@/types/hr";

/** In-memory org roster — hydrated from GET /api/employees after login. */
let roster: Employee[] = [];

export function setRoster(next: Employee[]) {
  roster = next;
}

export function getRoster(): Employee[] {
  return roster;
}

export function employeeById(id: string): Employee | undefined {
  return roster.find((e) => e.id === id);
}

export function employeeName(id: string): string {
  return employeeById(id)?.name ?? id;
}
