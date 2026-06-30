// Permissions matrix for Core Arena.
import type { AppRole, Employee, Role } from "@/types/hr";

// ---------- Tier (hierarchy model) ----------
export type Tier =
  | "leadership"
  | "zone_leader"
  | "hr"
  | "leader"
  | "recruiter"
  | "teammate"
  | "partner";

export const TIER_LABEL: Record<Tier, string> = {
  leadership: "Leadership",
  zone_leader: "Zone Leader",
  hr: "HR",
  leader: "Pod Lead",
  recruiter: "Recruiter",
  teammate: "Teammate",
  partner: "Property Partner",
};

export const TIER_TAGLINE: Record<Tier, string> = {
  leadership: "The whole arena, end to end. Revenue, direction, decisions.",
  zone_leader: "One zone. Every property, every pod, every number.",
  hr: "People, pulse, policy.",
  leader: "One pod. Coach the floor. Ship the day.",
  recruiter: "The funnel. Source, screen, seal.",
  teammate: "The day. Execute, learn, climb.",
  partner: "Your properties. Occupancy, payouts, requests.",
};

const LEADERSHIP_ROLES: Role[] = ["Admin"];
const ZONE_LEADER_ROLES: Role[] = ["Zone Leader"];
const PARTNER_ROLES: Role[] = ["Property Partner", "Owner"];
const HR_ROLES: Role[] = ["HR"];
const LEADER_ROLES: Role[] = ["Floor Lead", "Coach"];
const RECRUITER_ROLES: Role[] = ["Recruiter"];
// Teammates: Operator, Flow Ops, TCM, anyone unmatched.

export function tierOf(emp: Pick<Employee, "role" | "appRole">): Tier {
  if (LEADERSHIP_ROLES.includes(emp.role)) return "leadership";
  if (ZONE_LEADER_ROLES.includes(emp.role)) return "zone_leader";
  if (PARTNER_ROLES.includes(emp.role)) return "partner";
  if (HR_ROLES.includes(emp.role)) return "hr";
  if (LEADER_ROLES.includes(emp.role)) return "leader";
  if (RECRUITER_ROLES.includes(emp.role)) return "recruiter";
  if (emp.appRole === "admin") return "leadership";
  if (emp.appRole === "hr") return "hr";
  return "teammate";
}

export type Capability =
  | "view_all_attendance"
  | "edit_attendance"
  | "approve_leaves"
  | "assign_tasks_any"
  | "assign_tasks_team"
  | "view_team_scores"
  | "view_all_scores"
  | "give_kudos"
  | "broadcast_announcement"
  | "manage_users"
  | "manage_roles"
  | "view_war_room"
  | "view_payroll"
  | "view_own_score";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  hr: "HR",
  manager: "Manager",
  employee: "Employee",
};

export const ROLE_DESC: Record<AppRole, string> = {
  admin: "Full surface area. Owns the system.",
  hr: "People, pulse, policy.",
  manager: "Owns a team. Coaches, approves, decides.",
  employee: "Owns their day. Executes, learns, climbs.",
};

const MATRIX: Record<Capability, AppRole[]> = {
  view_all_attendance: ["admin", "manager"],
  edit_attendance: ["admin"],
  approve_leaves: ["admin", "manager"],
  assign_tasks_any: ["admin"],
  assign_tasks_team: ["admin", "manager"],
  view_team_scores: ["admin", "manager"],
  view_all_scores: ["admin"],
  give_kudos: ["admin", "manager", "employee"],
  broadcast_announcement: ["admin", "manager"],
  manage_users: ["admin"],
  manage_roles: ["admin"],
  view_war_room: ["admin", "manager"],
  view_payroll: ["admin"],
  view_own_score: ["admin", "manager", "employee"],
};

export function can(role: AppRole, cap: Capability): boolean {
  return MATRIX[cap].includes(role);
}

export const CAP_LIST: { cap: Capability; label: string; group: string }[] = [
  { cap: "view_own_score", label: "View own score", group: "Performance" },
  { cap: "view_team_scores", label: "View team scores", group: "Performance" },
  { cap: "view_all_scores", label: "View all scores", group: "Performance" },
  { cap: "view_all_attendance", label: "View attendance roster", group: "Attendance" },
  { cap: "edit_attendance", label: "Edit attendance entries", group: "Attendance" },
  { cap: "approve_leaves", label: "Approve / reject leaves", group: "Leaves" },
  { cap: "assign_tasks_team", label: "Assign tasks to team", group: "Tasks" },
  { cap: "assign_tasks_any", label: "Assign tasks to anyone", group: "Tasks" },
  { cap: "give_kudos", label: "Give kudos", group: "Recognition" },
  { cap: "broadcast_announcement", label: "Broadcast announcement", group: "Comms" },
  { cap: "view_war_room", label: "Open War Room", group: "Comms" },
  { cap: "manage_users", label: "Add / remove users", group: "Admin" },
  { cap: "manage_roles", label: "Change role assignments", group: "Admin" },
  { cap: "view_payroll", label: "View payroll signals", group: "Admin" },
];

export type ConsoleCapability =
  | "submit_eod"
  | "update_kpis"
  | "manage_personal_sprint"
  | "manage_comm_windows"
  | "access_playbooks"
  | "view_team_intelligence"
  | "view_team_analytics"
  | "view_comparative_analytics"
  | "manage_workforce_interventions"
  | "manage_org_health";

export function hasConsoleCapability(
  actor: Pick<Employee, "role" | "appRole">,
  cap: ConsoleCapability,
): boolean {
  const tier = tierOf(actor);

  // Admins have full access to all capabilities
  if (tier === "leadership" || actor.appRole === "admin") {
    return true;
  }

  const isOperator = ["Operator", "TCM", "Flow Ops"].includes(actor.role);

  switch (cap) {
    case "submit_eod":
    case "update_kpis":
    case "manage_personal_sprint":
      // Employees, Operators, Leads, Recruiter, HR (except partners)
      return tier !== "partner";

    case "access_playbooks":
      // Operators (teammates with Operator roles) and leaders/HR/recruiters who have playbooks
      return tier !== "partner";

    case "manage_comm_windows":
      // Operators or Floor Leads / HR / Recruiters / Zone Leaders
      return ["leader", "hr", "recruiter", "zone_leader"].includes(tier) || isOperator;

    case "view_team_intelligence":
    case "view_team_analytics":
    case "view_comparative_analytics":
    case "manage_workforce_interventions":
      // Leadership tiers (Leads, HR, Zone Leaders, Admin)
      return ["leader", "zone_leader", "hr"].includes(tier);

    case "manage_org_health":
      // HR
      return tier === "hr";

    default:
      return false;
  }
}

export type KpiCapability =
  | "manage_kpi_definitions"
  | "manage_org_kpi_targets"
  | "manage_zone_kpi_targets"
  | "manage_team_kpi_targets"
  | "view_kpi_governance"
  | "submit_kpi_values";

export function hasKpiCapability(
  actor: Pick<Employee, "role" | "appRole">,
  cap: KpiCapability,
): boolean {
  const tier = tierOf(actor);

  // Admin/Leadership appRole always has all capabilities
  if (tier === "leadership" || actor.appRole === "admin") {
    return true;
  }

  switch (cap) {
    case "view_kpi_governance":
      // Admin, HR, Zone Leader, Floor Lead (anyone in leadership/hr/zone_leader/leader)
      return ["hr", "zone_leader", "leader"].includes(tier as any);

    case "manage_kpi_definitions":
      // Only Admin has this (already handled by the top check, so return false here)
      return false;

    case "manage_org_kpi_targets":
      // Admin and HR Leadership
      return tier === "hr";

    case "manage_zone_kpi_targets":
      // Admin, HR, and Zone Leaders
      return ["zone_leader", "hr"].includes(tier as any);

    case "manage_team_kpi_targets":
      // Admin, HR, Zone Leaders, and Floor Leads
      return ["leader", "zone_leader", "hr"].includes(tier as any);

    case "submit_kpi_values":
      // All authenticated roles except property partners
      return tier !== "partner";

    default:
      return false;
  }
}
