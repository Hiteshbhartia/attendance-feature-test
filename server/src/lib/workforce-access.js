import crypto from "node:crypto";
import { User } from "../models/index.js";

// Operational roles (business titles) – remain capitalized for display and reporting
export const OPERATIONAL_ROLES = [
  "Admin",
  "Zone Leader",
  "Floor Lead",
  "Operator",
  "Flow Ops",
  "TCM",
  "HR",
  "Owner",
  "Coach",
  "Recruiter",
  "Property Partner",
];

// Auth roles – source of truth for permission checks (must be lower‑case)
export const AUTH_ROLES = ["admin", "hr", "manager", "employee"];

// App roles used during signup/invite flow – align with AUTH_ROLES
export const APP_ROLES = ["admin", "manager", "employee"];

/** Map app access role + operational job to JWT User.role enum. */
export function authRoleFromAppAccess(appRole, operationalRole = "") {
  // Map business (operational) role + requested app role to a normalized auth role (lower‑case)
  if (appRole === "admin") return "admin";
  if (operationalRole && operationalRole.toLowerCase() === "hr") return "hr";
  if (appRole === "manager") return "manager";
  return "employee";
}

// Temporary compatibility shim – accepts legacy upper‑case role strings during migration

export function publicAuthUser(u) {
  if (!u) return null;
  const status =
    u.isApproved && (!u.status || u.status === "pending") ? "active" : u.status || "pending";
  return {
    id: String(u._id),
    email: u.email,
    employeeId: u.employeeId ?? undefined,
    // Ensure role is lower‑case for callers
    role: typeof u.role === "string" ? u.role.toLowerCase() : u.role,
    isApproved: u.isApproved,
    isSuspended: Boolean(u.isSuspended),
    mustChangePassword: Boolean(u.mustChangePassword),
    status,
  };
}

export function accountStatus(user) {
  if (!user) return "no_account";
  return user.isApproved && (!user.status || user.status === "pending")
    ? "active"
    : user.status || "pending";
}

export function readProfile(emp) {
  return emp?.profile && typeof emp.profile === "object" ? { ...emp.profile } : {};
}

export function employeeOrgFields(emp) {
  const profile = readProfile(emp);
  return {
    id: emp.id,
    name: emp.name,
    operationalRole: emp.role,
    appRole: profile.appRole ?? "employee",
    team: profile.team ?? emp.hubId ?? "HQ",
    zone: profile.zone ?? emp.hubId ?? "All",
    managerId: emp.managerId ?? profile.managerId ?? null,
    experience: profile.experience ?? "Mid",
    shift: profile.shift ?? "10:00 - 19:00",
    email: emp.email ?? null,
  };
}

export async function countActiveAdmins() {
  return User.countDocuments({
    role: "admin",
    isApproved: true,
    isSuspended: { $ne: true },
  });
}

export function assertNotSelf(actorUserId, targetUserId, action) {
  if (String(actorUserId) === String(targetUserId)) {
    const err = new Error(`Cannot ${action} your own account`);
    err.status = 400;
    throw err;
  }
}

export async function assertCanDemoteAdmin(targetUser) {
  if (targetUser.role !== "admin") return;
  const admins = await countActiveAdmins();
  if (admins <= 1) {
    const err = new Error("Cannot remove the last active admin");
    err.status = 400;
    throw err;
  }
}

export async function assertCanSuspendAdmin(targetUser) {
  if (targetUser.role !== "admin") return;
  await assertCanDemoteAdmin(targetUser);
}

export function generateTempPassword() {
  const raw = crypto.randomBytes(9).toString("base64url");
  return `Gp${raw}!`;
}

export function mergeEmployeeProfile(emp, patch) {
  const profile = readProfile(emp);
  const next = { ...profile };

  if (patch.operationalRole) {
    emp.role = patch.operationalRole;
    emp.title = patch.operationalRole;
    next.role = patch.operationalRole;
  }
  if (patch.appRole) {
    next.appRole = patch.appRole;
  }
  if (patch.team !== undefined) {
    emp.hubId = patch.team;
    next.team = patch.team;
  }
  if (patch.zone !== undefined) {
    next.zone = patch.zone;
  }
  if (patch.managerId !== undefined) {
    emp.managerId = patch.managerId || undefined;
    next.managerId = patch.managerId;
  }
  if (patch.experience) next.experience = patch.experience;
  if (patch.shift) next.shift = patch.shift;
  if (patch.name) {
    emp.name = patch.name;
    next.name = patch.name;
  }
  if (patch.birthday !== undefined) {
    emp.birthday = patch.birthday;
    next.birthday = patch.birthday;
  }
  if (patch.avatarSeed !== undefined) {
    next.avatarSeed = patch.avatarSeed;
  }

  emp.profile = next;
  emp.markModified("profile");
  return emp;
}

export function newEmployeeId() {
  return `e-${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`;
}
