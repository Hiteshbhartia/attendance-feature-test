/**
 * lib/permissions.ts
 *
 * Centralized permission system for hierarchy-aware access control.
 *
 * Design principles:
 * - Permissions are strings (easy to extend, serialize, store)
 * - Roles map to permission sets (configurable, not hardcoded)
 * - canAccess() is the single entry point for all permission checks
 * - Hierarchy level determines data visibility scope
 * - Backward compatible: existing admin/employee flows unchanged
 */

import type { AuthPayload } from '@/types';
import { getHierarchySubtree, isInReportingSubtree } from './hierarchy-utils';
import { DEFAULT_HIERARCHY_CAPABILITIES } from '@/components/hierarchy/types';

// ─── Permission Definitions ───────────────────────────────────────────────────
// Add new permissions here as features grow. Never remove existing ones.

export const PERMISSIONS = {
  // Employee management
  VIEW_ALL_EMPLOYEES:       'VIEW_ALL_EMPLOYEES',
  VIEW_TEAM_EMPLOYEES:      'VIEW_TEAM_EMPLOYEES',
  CREATE_EMPLOYEE:          'CREATE_EMPLOYEE',
  EDIT_EMPLOYEE:            'EDIT_EMPLOYEE',
  DELETE_EMPLOYEE:          'DELETE_EMPLOYEE',
  APPROVE_EMPLOYEE:         'APPROVE_EMPLOYEE',

  // Attendance
  VIEW_OWN_ATTENDANCE:      'VIEW_OWN_ATTENDANCE',
  VIEW_TEAM_ATTENDANCE:     'VIEW_TEAM_ATTENDANCE',
  VIEW_ALL_ATTENDANCE:      'VIEW_ALL_ATTENDANCE',
  MANAGE_ATTENDANCE_POLICY: 'MANAGE_ATTENDANCE_POLICY',

  // Reports
  VIEW_OWN_REPORTS:         'VIEW_OWN_REPORTS',
  VIEW_TEAM_REPORTS:        'VIEW_TEAM_REPORTS',
  VIEW_ORG_REPORTS:         'VIEW_ORG_REPORTS',
  EXPORT_REPORTS:           'EXPORT_REPORTS',

  // Reviews & Performance
  VIEW_OWN_REVIEWS:         'VIEW_OWN_REVIEWS',
  REVIEW_TEAM_MEMBERS:      'REVIEW_TEAM_MEMBERS',
  REVIEW_ALL_MEMBERS:       'REVIEW_ALL_MEMBERS',

  // 1:1 Sessions
  HOST_ONE_ON_ONE:          'HOST_ONE_ON_ONE',
  VIEW_OWN_ONE_ON_ONE:      'VIEW_OWN_ONE_ON_ONE',
  VIEW_TEAM_ONE_ON_ONE:     'VIEW_TEAM_ONE_ON_ONE',

  // Team management
  MANAGE_TEAM:              'MANAGE_TEAM',
  ASSIGN_MANAGER:           'ASSIGN_MANAGER',
  VIEW_TEAM_DASHBOARD:      'VIEW_TEAM_DASHBOARD',

  // Leaves
  APPLY_LEAVE:              'APPLY_LEAVE',
  APPROVE_TEAM_LEAVE:       'APPROVE_TEAM_LEAVE',
  APPROVE_ALL_LEAVE:        'APPROVE_ALL_LEAVE',
  VIEW_TEAM_LEAVES:         'VIEW_TEAM_LEAVES',
  VIEW_ALL_LEAVES:          'VIEW_ALL_LEAVES',

  // Holidays
  MANAGE_HOLIDAYS:          'MANAGE_HOLIDAYS',

  // Settings & Admin
  VIEW_ADMIN_PANEL:         'VIEW_ADMIN_PANEL',
  MANAGE_SETTINGS:          'MANAGE_SETTINGS',
  MANAGE_ROLES:             'MANAGE_ROLES',
  RESET_PASSWORD:           'RESET_PASSWORD',
  VIEW_AUDIT_LOGS:          'VIEW_AUDIT_LOGS',

  // Coaching
  VIEW_OWN_COACHING:        'VIEW_OWN_COACHING',
  MANAGE_TEAM_COACHING:     'MANAGE_TEAM_COACHING',
  MANAGE_ALL_COACHING:      'MANAGE_ALL_COACHING',

  // Kudos
  GIVE_KUDOS:               'GIVE_KUDOS',
  VIEW_KUDOS:               'VIEW_KUDOS',

  // Tracker / Daily updates
  VIEW_OWN_TRACKER:         'VIEW_OWN_TRACKER',
  VIEW_TEAM_TRACKER:        'VIEW_TEAM_TRACKER',
  VIEW_ALL_TRACKER:         'VIEW_ALL_TRACKER',

  // Notices
  VIEW_NOTICES:             'VIEW_NOTICES',
  CREATE_NOTICE:            'CREATE_NOTICE',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ─── Hierarchy Levels ─────────────────────────────────────────────────────────
// Lower number = higher authority. Used for comparison logic.

export const HIERARCHY_LEVELS = {
  ADMIN:      0,
  MANAGER:    1,
  TEAM_LEAD:  2,
  HR:         3,
  EMPLOYEE:   4,
} as const;

export type HierarchyRole = keyof typeof HIERARCHY_LEVELS;

// ─── Role → Permission Mapping ────────────────────────────────────────────────
// This is the single source of truth for what each role can do.
// Extend by adding new roles here without touching any other file.

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    // Full access to everything
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.VIEW_TEAM_EMPLOYEES,
    PERMISSIONS.CREATE_EMPLOYEE,
    PERMISSIONS.EDIT_EMPLOYEE,
    PERMISSIONS.DELETE_EMPLOYEE,
    PERMISSIONS.APPROVE_EMPLOYEE,
    PERMISSIONS.VIEW_OWN_ATTENDANCE,
    PERMISSIONS.VIEW_TEAM_ATTENDANCE,
    PERMISSIONS.VIEW_ALL_ATTENDANCE,
    PERMISSIONS.MANAGE_ATTENDANCE_POLICY,
    PERMISSIONS.VIEW_OWN_REPORTS,
    PERMISSIONS.VIEW_TEAM_REPORTS,
    PERMISSIONS.VIEW_ORG_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_OWN_REVIEWS,
    PERMISSIONS.REVIEW_TEAM_MEMBERS,
    PERMISSIONS.REVIEW_ALL_MEMBERS,
    PERMISSIONS.HOST_ONE_ON_ONE,
    PERMISSIONS.VIEW_OWN_ONE_ON_ONE,
    PERMISSIONS.VIEW_TEAM_ONE_ON_ONE,
    PERMISSIONS.MANAGE_TEAM,
    PERMISSIONS.ASSIGN_MANAGER,
    PERMISSIONS.VIEW_TEAM_DASHBOARD,
    PERMISSIONS.APPLY_LEAVE,
    PERMISSIONS.APPROVE_TEAM_LEAVE,
    PERMISSIONS.APPROVE_ALL_LEAVE,
    PERMISSIONS.VIEW_TEAM_LEAVES,
    PERMISSIONS.VIEW_ALL_LEAVES,
    PERMISSIONS.MANAGE_HOLIDAYS,
    PERMISSIONS.VIEW_ADMIN_PANEL,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.RESET_PASSWORD,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.VIEW_OWN_COACHING,
    PERMISSIONS.MANAGE_TEAM_COACHING,
    PERMISSIONS.MANAGE_ALL_COACHING,
    PERMISSIONS.GIVE_KUDOS,
    PERMISSIONS.VIEW_KUDOS,
    PERMISSIONS.VIEW_OWN_TRACKER,
    PERMISSIONS.VIEW_TEAM_TRACKER,
    PERMISSIONS.VIEW_ALL_TRACKER,
    PERMISSIONS.VIEW_NOTICES,
    PERMISSIONS.CREATE_NOTICE,
  ],

  manager: [
    PERMISSIONS.VIEW_TEAM_EMPLOYEES,
    PERMISSIONS.CREATE_EMPLOYEE,
    PERMISSIONS.EDIT_EMPLOYEE,
    PERMISSIONS.VIEW_OWN_ATTENDANCE,
    PERMISSIONS.VIEW_TEAM_ATTENDANCE,
    PERMISSIONS.VIEW_OWN_REPORTS,
    PERMISSIONS.VIEW_TEAM_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_OWN_REVIEWS,
    PERMISSIONS.REVIEW_TEAM_MEMBERS,
    PERMISSIONS.HOST_ONE_ON_ONE,
    PERMISSIONS.VIEW_OWN_ONE_ON_ONE,
    PERMISSIONS.VIEW_TEAM_ONE_ON_ONE,
    PERMISSIONS.MANAGE_TEAM,
    PERMISSIONS.VIEW_TEAM_DASHBOARD,
    PERMISSIONS.APPLY_LEAVE,
    PERMISSIONS.APPROVE_TEAM_LEAVE,
    PERMISSIONS.VIEW_TEAM_LEAVES,
    PERMISSIONS.VIEW_OWN_COACHING,
    PERMISSIONS.MANAGE_TEAM_COACHING,
    PERMISSIONS.GIVE_KUDOS,
    PERMISSIONS.VIEW_KUDOS,
    PERMISSIONS.VIEW_OWN_TRACKER,
    PERMISSIONS.VIEW_TEAM_TRACKER,
    PERMISSIONS.VIEW_NOTICES,
    PERMISSIONS.CREATE_NOTICE,
  ],

  team_lead: [
    PERMISSIONS.VIEW_TEAM_EMPLOYEES,
    PERMISSIONS.VIEW_OWN_ATTENDANCE,
    PERMISSIONS.VIEW_TEAM_ATTENDANCE,
    PERMISSIONS.VIEW_OWN_REPORTS,
    PERMISSIONS.VIEW_TEAM_REPORTS,
    PERMISSIONS.VIEW_OWN_REVIEWS,
    PERMISSIONS.REVIEW_TEAM_MEMBERS,
    PERMISSIONS.HOST_ONE_ON_ONE,
    PERMISSIONS.VIEW_OWN_ONE_ON_ONE,
    PERMISSIONS.VIEW_TEAM_ONE_ON_ONE,
    PERMISSIONS.VIEW_TEAM_DASHBOARD,
    PERMISSIONS.APPLY_LEAVE,
    PERMISSIONS.APPROVE_TEAM_LEAVE,
    PERMISSIONS.VIEW_TEAM_LEAVES,
    PERMISSIONS.VIEW_OWN_COACHING,
    PERMISSIONS.MANAGE_TEAM_COACHING,
    PERMISSIONS.GIVE_KUDOS,
    PERMISSIONS.VIEW_KUDOS,
    PERMISSIONS.VIEW_OWN_TRACKER,
    PERMISSIONS.VIEW_TEAM_TRACKER,
    PERMISSIONS.VIEW_NOTICES,
  ],

  hr: [
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.VIEW_TEAM_EMPLOYEES,
    PERMISSIONS.EDIT_EMPLOYEE,
    PERMISSIONS.APPROVE_EMPLOYEE,
    PERMISSIONS.VIEW_OWN_ATTENDANCE,
    PERMISSIONS.VIEW_ALL_ATTENDANCE,
    PERMISSIONS.VIEW_OWN_REPORTS,
    PERMISSIONS.VIEW_ORG_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_OWN_REVIEWS,
    PERMISSIONS.REVIEW_ALL_MEMBERS,
    PERMISSIONS.VIEW_OWN_ONE_ON_ONE,
    PERMISSIONS.APPLY_LEAVE,
    PERMISSIONS.APPROVE_ALL_LEAVE,
    PERMISSIONS.VIEW_TEAM_LEAVES,
    PERMISSIONS.VIEW_ALL_LEAVES,
    PERMISSIONS.MANAGE_HOLIDAYS,
    PERMISSIONS.VIEW_OWN_COACHING,
    PERMISSIONS.GIVE_KUDOS,
    PERMISSIONS.VIEW_KUDOS,
    PERMISSIONS.VIEW_OWN_TRACKER,
    PERMISSIONS.VIEW_NOTICES,
    PERMISSIONS.CREATE_NOTICE,
  ],

  employee: [
    PERMISSIONS.VIEW_OWN_ATTENDANCE,
    PERMISSIONS.VIEW_OWN_REPORTS,
    PERMISSIONS.VIEW_OWN_REVIEWS,
    PERMISSIONS.VIEW_OWN_ONE_ON_ONE,
    PERMISSIONS.APPLY_LEAVE,
    PERMISSIONS.VIEW_OWN_COACHING,
    PERMISSIONS.GIVE_KUDOS,
    PERMISSIONS.VIEW_KUDOS,
    PERMISSIONS.VIEW_OWN_TRACKER,
    PERMISSIONS.VIEW_NOTICES,
  ],
};

// ─── Capability Mapping ───────────────────────────────────────────────────────
// Maps internal PERMISSIONS to HierarchyRole capability keys.
const PERMISSION_TO_CAPABILITY: Partial<Record<Permission, string>> = {
  [PERMISSIONS.VIEW_ALL_EMPLOYEES]:   'canManageReports',
  [PERMISSIONS.VIEW_TEAM_EMPLOYEES]:  'canManageReports',
  [PERMISSIONS.VIEW_TEAM_ATTENDANCE]: 'canViewAttendance',
  [PERMISSIONS.VIEW_ALL_ATTENDANCE]:  'canViewAttendance',
  [PERMISSIONS.MANAGE_ATTENDANCE_POLICY]: 'canEditAttendance',
  [PERMISSIONS.APPROVE_TEAM_LEAVE]:   'canApproveRequests',
  [PERMISSIONS.APPROVE_ALL_LEAVE]:    'canApproveRequests',
  [PERMISSIONS.HOST_ONE_ON_ONE]:      'canConduct1on1s',
  [PERMISSIONS.MANAGE_TEAM_COACHING]: 'canConduct1on1s',
  [PERMISSIONS.MANAGE_ALL_COACHING]:  'canManageHierarchy',
  [PERMISSIONS.VIEW_TEAM_DASHBOARD]:  'canViewTeamDashboards',
  [PERMISSIONS.VIEW_TEAM_TRACKER]:    'canViewKPIs',
  [PERMISSIONS.VIEW_ALL_TRACKER]:     'canViewKPIs',
};

// ─── Core Permission Check ────────────────────────────────────────────────────

/**
 * Primary access control function. Use this everywhere instead of inline role checks.
 * FAIL-SAFE: Admins always have access, regardless of capability/data state.
 */
export function canAccess(user: AuthPayload & { capabilities?: Record<string, boolean> | null }, permission: Permission): boolean {
  if (!user) return false;

  // 1. ADMIN FAILSAFE: Never block admin access
  if (isAdmin(user)) return true;

  // 2. Check Capability Source of Truth (HierarchyRole)
  const capabilityKey = PERMISSION_TO_CAPABILITY[permission];
  const capabilities = user.capabilities || {};
  
  if (capabilityKey && typeof capabilities[capabilityKey] === 'boolean') {
    return capabilities[capabilityKey];
  }

  // 3. Fallback to Legacy Role Permissions
  const role = normalizeRole(user.role, user.systemRole ?? null);
  const perms = ROLE_PERMISSIONS[role] ?? [];
  const hasLegacyPerm = perms.includes(permission);

  if (process.env.NODE_ENV === 'development' && !hasLegacyPerm && capabilityKey) {
    console.warn(`[Permission Denied] User: ${user.email}, Permission: ${permission}, Capability: ${capabilityKey} (Missing or False)`);
  }

  return hasLegacyPerm;
}

/** 
 * Centralized capability check with safe defaults.
 * Use for feature-specific flags that aren't mapped to standard permissions.
 */
export function hasCapability(user: AuthPayload & { capabilities?: Record<string, boolean> | null }, key: string, fallback = false): boolean {
  if (!user) return fallback;
  if (isAdmin(user)) return true;
  
  const val = (user.capabilities || {})[key];
  return typeof val === 'boolean' ? val : fallback;
}

/**
 * FAIL-SAFE helper for coaching module access.
 */
export function canAccessCoaching(user: AuthPayload & { capabilities?: Record<string, boolean> | null }): boolean {
  return canAccess(user, PERMISSIONS.MANAGE_TEAM_COACHING) || canAccess(user, PERMISSIONS.VIEW_OWN_COACHING);
}

export function canAccessAll(user: AuthPayload & { capabilities?: Record<string, boolean> }, permissions: Permission[]): boolean {
  return permissions.every(p => canAccess(user, p));
}

export function canAccessAny(user: AuthPayload & { capabilities?: Record<string, boolean> }, permissions: Permission[]): boolean {
  return permissions.some(p => canAccess(user, p));
}

export function getUserPermissions(user: AuthPayload & { capabilities?: Record<string, boolean> }): Permission[] {
  const role = normalizeRole(user.role, user.systemRole ?? null);
  return ROLE_PERMISSIONS[role] ?? [];
}

// ─── Hierarchy Utilities ──────────────────────────────────────────────────────

/**
 * Returns the numeric hierarchy level for a role.
 * Lower = more authority. Returns 99 for unknown roles.
 */
export function getHierarchyLevel(role: string, systemRole?: string | null): number {
  const normalized = normalizeRole(role, systemRole) as HierarchyRole;
  return HIERARCHY_LEVELS[normalized] ?? 99;
}

export function isHigherAuthority(roleA: string, roleB: string): boolean {
  return getHierarchyLevel(roleA) < getHierarchyLevel(roleB);
}

export function isElevated(user: AuthPayload): boolean {
  return getHierarchyLevel(user.role, user.systemRole ?? null) <= HIERARCHY_LEVELS.MANAGER;
}

export function isAdmin(user: AuthPayload): boolean {
  return normalizeRole(user.role, user.systemRole ?? null) === 'admin';
}

export function isTeamLead(user: AuthPayload): boolean {
  return getHierarchyLevel(user.role, user.systemRole ?? null) <= HIERARCHY_LEVELS.TEAM_LEAD;
}

// ─── Scoped Data Visibility ───────────────────────────────────────────────────

/**
 * Builds a MongoDB filter for employee queries based on the caller's role.
 *
 * - admin / hr          → sees all employees (returns base filter)
 * - manager / team_lead → sees only their entire reporting subtree (direct + indirect)
 * - employee            → not allowed (returns null)
 *
 * @param user  Decoded JWT payload
 * @param base  Additional filter conditions to merge
 * @returns Filter object or null if caller is not permitted
 */
export async function buildScopedEmployeeFilter(
  user: AuthPayload,
  base: Record<string, unknown> = {}
): Promise<Record<string, unknown> | null> {
  const role = normalizeRole(user.role, user.systemRole ?? null);

  // Employees cannot query the employee list
  if (role === 'employee') return null;

  // Admin and HR always see everyone — no scope restriction
  if (role === 'admin' || role === 'hr') {
    return base;
  }

  // Managers and team leads see their entire reporting subtree
  if (role === 'manager' || role === 'team_lead') {
    const subtree = await getHierarchySubtree(user.id);
    return { ...base, _id: { $in: subtree } };
  }

  // Safety net: unknown roles fall back to admin-level visibility
  return base;
}

/**
 * Returns true if the user can access data for a specific employee.
 *
 * - admin / hr    → always true
 * - manager / TL  → true if they are in the reporting chain (direct or indirect)
 * - employee      → true only for their own data
 */
export async function canAccessEmployeeData(
  user: AuthPayload,
  employeeId: string,
  employeeManagerId?: string | null
): Promise<boolean> {
  const role = normalizeRole(user.role, user.systemRole ?? null);

  if (role === 'admin' || role === 'hr') return true;

  if (role === 'manager' || role === 'team_lead') {
    // Check direct report first (optimization)
    if (employeeManagerId === user.id) return true;
    // Check entire subtree
    return isInReportingSubtree(user.id, employeeId);
  }

  // Employee can only access their own data
  return user.id === employeeId;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Normalizes role strings to lowercase for consistent lookups.
 * systemRole takes precedence over role when present.
 * Handles legacy values like 'sub_admin' gracefully.
 */
function normalizeRole(role: string, systemRole?: string | null): string {
  // systemRole takes precedence only when it is a non-empty, non-null string.
  // null and undefined both fall back to the legacy `role` field.
  // This ensures existing users without systemRole set still work correctly.
  const effective = (systemRole != null && systemRole !== '') ? systemRole : role;
  const r = (effective || '').toLowerCase().trim();
  // Legacy mappings for backward compatibility
  if (r === 'sub_admin') return 'manager';
  return r;
}
