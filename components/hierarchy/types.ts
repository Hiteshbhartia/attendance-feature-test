/**
 * components/hierarchy/types.ts
 *
 * Shared TypeScript interfaces for the hierarchy UI layer.
 * Mirrors the shape returned by /api/org and /api/hierarchy/* endpoints.
 */

export const DEFAULT_HIERARCHY_CAPABILITIES = {
  canViewKPIs: false,
  canEditKPIs: false,
  canCreateKPIs: false,
  canViewAttendance: false,
  canEditAttendance: false,
  canConduct1on1s: false,
  canManageReports: false,
  canApproveRequests: false,
  canViewTeamDashboards: false,
};

/**
 * Returns intelligent capability presets based on the system tier.
 * These are initial suggestions that can be manually overridden.
 */
export function getDefaultCapabilitiesForTier(tier: string) {
  const base = { ...DEFAULT_HIERARCHY_CAPABILITIES };

  switch (tier.toLowerCase()) {
    case 'admin':
      return Object.keys(base).reduce((acc, key) => ({ ...acc, [key]: true }), {});
    
    case 'manager':
      return {
        ...base,
        canViewKPIs: true,
        canEditKPIs: true,
        canCreateKPIs: true,
        canViewAttendance: true,
        canConduct1on1s: true,
        canManageReports: true,
        canApproveRequests: true,
        canViewTeamDashboards: true,
      };

    case 'team_lead':
      return {
        ...base,
        canViewKPIs: true,
        canEditKPIs: true,
        canViewAttendance: true,
        canConduct1on1s: true,
        canViewTeamDashboards: true,
      };

    case 'hr':
      return {
        ...base,
        canViewKPIs: true,
        canViewAttendance: true,
        canConduct1on1s: true,
        canApproveRequests: true,
      };

    case 'employee':
    default:
      return {
        ...base,
        canViewKPIs: true,
        canViewAttendance: true,
      };
  }
}

export interface HierarchyRoleMeta {
  _id?: string;
  name: string;
  color: string;
  level?: number;
}

/** A member inside a group (employee or team lead) */
export interface HierarchyMember {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  systemRole: string;
  hierarchyRole: HierarchyRoleMeta | null;
  teamName: string;
  team: string;
  jobRole: string;
  isApproved: boolean;
  managerId: string | null;
  managerName: string | null;
  officeZoneId: string | null;
  officeZoneName: string | null;
}

/** A top-level group in the tree (manager node or zone node) */
export interface HierarchyGroup {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  systemRole: string;
  hierarchyRole: HierarchyRoleMeta | null;
  team: string;
  groupType: 'manager' | 'zone';
  reports: HierarchyMember[];
}

/** An available manager for the "Reports To" dropdown */
export interface AvailableManager {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  systemRole: string;
  hierarchyRole: { name: string; color: string } | null;
}

/** Full response shape from GET /api/org */
export interface OrgApiResponse {
  ok: boolean;
  tree: HierarchyGroup[];
  unassigned: HierarchyMember[];
  total: number;
  groupedByZone: boolean;
  availableManagers: AvailableManager[];
}

/** A configurable hierarchy role definition from /api/hierarchy/roles */
export interface HierarchyRoleDef {
  _id: string;
  name: string;
  slug: string;
  systemRole: string;
  level: number;
  color: string;
  capabilities: {
    canViewKPIs: boolean;
    canEditKPIs: boolean;
    canCreateKPIs: boolean;
    canViewAttendance: boolean;
    canEditAttendance: boolean;
    canConduct1on1s: boolean;
    canManageReports: boolean;
    canApproveRequests: boolean;
    canViewTeamDashboards: boolean;
  };
}

/** Edit form state for assigning manager/team/department */
export interface OrgEditState {
  managerId: string;
  teamName: string;
  jobTitle: string;
}

/** Edit form state for assigning hierarchy role */
export interface HierarchyAssignState {
  hierarchyRoleId: string;
  managerId: string;
}
