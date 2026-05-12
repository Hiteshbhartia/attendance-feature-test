'use client';
/**
 * components/hierarchy/HierarchyNode.tsx
 *
 * A single employee card inside the hierarchy tree.
 * Shows: avatar, name, role badge, team/dept tags, reports-to, direct report count.
 * Inline edit: manager, team name, department.
 */

import { Check, X, Edit2, Users, UserCog, MapPin } from 'lucide-react';
import RoleBadge from './RoleBadge';
import { avColor, initials } from './avatar';
import type { HierarchyMember, AvailableManager, OrgEditState } from './types';

interface HierarchyNodeProps {
  member: HierarchyMember;
  directReportCount?: number;
  canEdit: boolean;
  isEditing: boolean;
  editData: OrgEditState;
  saving: boolean;
  availableManagers: AvailableManager[];
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditChange: (patch: Partial<OrgEditState>) => void;
  /** Opens the full AssignModal for role + manager assignment */
  onAssign?: () => void;
}

export default function HierarchyNode({
  member,
  directReportCount,
  canEdit,
  isEditing,
  editData,
  saving,
  availableManagers,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditChange,
  onAssign,
}: HierarchyNodeProps) {
  const color = avColor(member.fullName);
  const ini   = initials(member.fullName);

  return (
    <div
      className="rounded-2xl transition-all"
      style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}
    >
      {/* ── Main row ── */}
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
            style={{ background: color }}
          >
            {ini}
          </div>

          {/* Info */}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{member.fullName}</div>

            {/* Role badges */}
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              <RoleBadge hierarchyRole={member.hierarchyRole} role={member.role} />
              {member.jobRole && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {member.jobRole}
                </span>
              )}
            </div>

            {/* Team & Zone tags */}
            {!isEditing && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {member.teamName && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                    {member.teamName}
                  </span>
                )}
                {member.officeZoneName && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-1"
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                    <MapPin className="w-2 h-2" />
                    {member.officeZoneName}
                  </span>
                )}
              </div>
            )}

            {/* Reports-to + direct report count */}
            {!isEditing && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {member.managerName && (
                  <span className="text-[9px] text-gray-400">
                    → {member.managerName}
                  </span>
                )}
                {directReportCount !== undefined && directReportCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[9px] text-indigo-400">
                    <Users className="w-2.5 h-2.5" />
                    {directReportCount} report{directReportCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Edit / Assign / Save / Cancel buttons */}
        {canEdit && !isEditing && (
          <div className="flex gap-1 flex-shrink-0">
            {/* Assign role + manager (opens full modal) */}
            {onAssign && (
              <button
                onClick={onAssign}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}
                aria-label="Assign role / manager"
                title="Assign role & reporting manager"
              >
                <UserCog className="w-3 h-3" />
              </button>
            )}
            {/* Inline edit (team name + department) */}
            <button
              onClick={onStartEdit}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 transition"
              style={{ color: '#9ca3af' }}
              aria-label="Edit team"
              title="Edit team"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}
        {isEditing && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onSaveEdit}
              disabled={saving}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition disabled:opacity-50"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
              aria-label="Save"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={onCancelEdit}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 transition"
              style={{ color: '#6b7280' }}
              aria-label="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Inline edit form ── */}
      {isEditing && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t" style={{ borderColor: '#f3f4f6' }}>
          <div className="pt-2" />

          {/* Reports To */}
          {availableManagers.length > 0 && (
            <div>
              <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Reports To
              </label>
              <select
                value={editData.managerId}
                onChange={e => onEditChange({ managerId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none"
                style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151' }}
              >
                <option value="">— No Manager —</option>
                {availableManagers.map(m => (
                  <option key={m._id} value={m._id}>
                    {m.fullName} ({m.hierarchyRole?.name ?? m.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Team */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Team
            </label>
            <input
              value={editData.teamName}
              onChange={e => onEditChange({ teamName: e.target.value })}
              placeholder="e.g. Backend"
              className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none text-gray-700 placeholder-gray-400"
              style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
