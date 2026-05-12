/**
 * models/HierarchyRole.ts
 *
 * Configurable hierarchy role definitions stored in the database.
 * This allows adding new roles (HR, Recruiter, Floor Lead, etc.)
 * without code changes — just insert a new document.
 *
 * The `systemRole` field maps to the permission tier in lib/permissions.ts.
 * Multiple named roles can share the same permission tier.
 *
 * Example documents:
 *   { name: 'Regional Manager', slug: 'regional_manager', systemRole: 'manager', level: 1 }
 *   { name: 'Floor Lead',       slug: 'floor_lead',       systemRole: 'team_lead', level: 2 }
 *   { name: 'HR Executive',     slug: 'hr_executive',     systemRole: 'hr',        level: 3 }
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IHierarchyRole extends Document {
  /** Display name shown in UI, e.g. "Regional Manager" */
  name: string;
  /** URL-safe identifier, e.g. "regional_manager" */
  slug: string;
  /**
   * Maps to the permission tier in lib/permissions.ts.
   * Valid values: 'admin' | 'manager' | 'team_lead' | 'hr' | 'employee'
   * This is what drives actual access control.
   */
  systemRole: string;
  /**
   * Numeric hierarchy level. Lower = higher authority.
   * Used for display ordering and comparison logic.
   * 0=Admin, 1=Manager, 2=TeamLead, 3=HR, 4=Employee
   */
  level: number;
  /** Badge color for UI display */
  color: string;
  /** Whether this role is currently active */
  isActive: boolean;
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

const HierarchyRoleSchema = new Schema<IHierarchyRole>(
  {
    name:            { type: String, required: true, trim: true },
    slug:            { type: String, required: true, unique: true, lowercase: true, trim: true },
    systemRole:      {
      type: String,
      required: true,
      enum: ['admin', 'manager', 'team_lead', 'hr', 'employee'],
      default: 'employee',
    },
    level:           { type: Number, required: true, default: 4 },
    color:           { type: String, default: '#6b7280' },
    isActive:        { type: Boolean, default: true },
    capabilities:     {
      canViewKPIs:          { type: Boolean, default: false },
      canEditKPIs:          { type: Boolean, default: false },
      canCreateKPIs:        { type: Boolean, default: false },
      canViewAttendance:    { type: Boolean, default: false },
      canEditAttendance:    { type: Boolean, default: false },
      canConduct1on1s:   { type: Boolean, default: false },
      canManageReports:     { type: Boolean, default: false },
      canApproveRequests:   { type: Boolean, default: false },
      canViewTeamDashboards: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    collection: 'gp_hierarchy_roles',
  }
);

HierarchyRoleSchema.index({ systemRole: 1, isActive: 1 });
HierarchyRoleSchema.index({ level: 1 });

export default mongoose.models?.GpHierarchyRole ||
  mongoose.model<IHierarchyRole>('GpHierarchyRole', HierarchyRoleSchema);
