import { api } from "@/lib/api-client";
import type { AppRole, Employee, Role } from "@/types/hr";
import type { ApiUser } from "@/lib/api-client";
import { setRoster } from "@/lib/roster";

export type ApiEmployeeRecord = {
  id: string;
  name: string;
  role: string;
  title?: string;
  managerId?: string;
  hubId?: string;
  email?: string;
  profile?: Employee;
  hideTasks?: boolean;
};

const ROLE_ALIASES: Record<string, Role> = {
  Admin: "Admin",
  "Zone Leader": "Zone Leader",
  "Floor Lead": "Floor Lead",
  Manager: "Floor Lead",
  Operator: "Operator",
  HR: "HR",
  Recruiter: "Recruiter",
  Coach: "Coach",
  "Flow Ops": "Flow Ops",
  TCM: "TCM",
  "Property Partner": "Property Partner",
  Owner: "Owner",
};

function mapRecordRole(role: string): Role {
  return ROLE_ALIASES[role] ?? "Operator";
}

function appRoleFromApiUser(role: ApiUser["role"]): AppRole {
  if (role === "admin") return "admin";
  if (role === "hr") return "hr";
  if (role === "employee") return "employee";
  return "manager";
}

export function mapApiEmployee(record: ApiEmployeeRecord, user?: ApiUser | null): Employee {
  const role = mapRecordRole(record.role);
  const appRole =
    record.profile?.appRole ??
    (user?.employeeId === record.id ? appRoleFromApiUser(user.role) : "employee");

  // Generate stable random variations based on the employee ID
  const seed = Array.from(record.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const mod1 = (seed % 15) - 5; // -5 to +9
  const mod2 = (seed % 20) - 10; // -10 to +9
  const mod3 = (seed % 25) - 12; // -12 to +12
  const mod4 = (seed % 10) - 5;

  const defaults: Omit<Employee, "id" | "name" | "role" | "appRole"> = {
    experience: "New",
    attendance: 0,
    performance: 0,
    consistency: 0,
    revenueImpact: 0,
    taskCompletion: 0,
    conversion: 0,
    callsToday: 0,
    callTarget: 30,
    leadsActive: 0,
    closedDeals: 0,
    lostDeals: 0,
    flags: [],
    status: "Active",
    streakDays: 0,
    team: record.hubId ?? "HQ",
    shift: "10:00 - 19:00",
    avatarSeed: record.name.split(" ")[0] ?? record.id,
    zone: record.hubId ?? "All",
    managerId: record.managerId ?? null,
  };

  if (record.profile) {
    return {
      ...defaults,
      ...record.profile,
      id: record.id,
      name: record.name,
      role,
      appRole,
      managerId: record.managerId ?? record.profile.managerId ?? null,
      team: record.hubId ?? record.profile.team ?? "HQ",
      hideTasks: record.hideTasks ?? record.profile.hideTasks ?? false,
    };
  }

  return {
    id: record.id,
    name: record.name,
    role,
    appRole,
    hideTasks: record.hideTasks ?? false,
    ...defaults,
  };
}

export function employeeForUser(user: ApiUser, roster: Employee[]): Employee | null {
  if (user.employeeId) {
    const linked = roster.find((e) => e.id === user.employeeId);
    if (linked) return linked;
  }
  return null;
}

export function fallbackEmployeeForUser(user: ApiUser): Employee {
  const roleByAccount: Record<ApiUser["role"], Role> = {
    admin: "Admin",
    hr: "HR",
    manager: "Floor Lead",
    employee: "Operator",
  };
  const id = user.employeeId ?? user.id;
  const name =
    user.email
      .split("@")[0]
      ?.replace(/[._]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "User";

  return {
    id,
    name,
    role: roleByAccount[user.role],
    appRole: appRoleFromApiUser(user.role),
    experience: "Mid",
    attendance: 85,
    performance: 70,
    consistency: 70,
    revenueImpact: 0,
    taskCompletion: 75,
    conversion: 15,
    callsToday: 0,
    callTarget: 30,
    leadsActive: 0,
    closedDeals: 0,
    lostDeals: 0,
    flags: [],
    status: "Active",
    streakDays: 0,
    team: "HQ",
    shift: "10:00 - 19:00",
    avatarSeed: name,
    zone: "All",
    managerId: null,
  };
}

export async function fetchEmployeeRoster(user: ApiUser): Promise<Employee[]> {
  console.log('[employees-api] fetchEmployeeRoster start');

  const res = await api.get<{ items: ApiEmployeeRecord[] }>("/employees");
  console.log('[employees-api] fetchEmployeeRoster received', res.items?.length, 'items');
  let roster = (res.items ?? []).map((row) => mapApiEmployee(row, user));
  
  if (!employeeForUser(user, roster)) {
    const self = fallbackEmployeeForUser(user);
    roster = [self, ...roster];
    console.log('[employees-api] fallback roster for user', user.id, 'added to roster');
  }

  setRoster(roster);
  console.log('[employees-api] roster set with', roster.length, 'employees');
  console.log('[employees-api] fetchEmployeeRoster end');
  return roster;
}

export function resolveActor(user: ApiUser, roster: Employee[]): Employee {
  return employeeForUser(user, roster) ?? fallbackEmployeeForUser(user);
}
