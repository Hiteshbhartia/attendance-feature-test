'use client';
import { useState, useCallback, useEffect } from 'react';
import { AlertCircle, UserPlus, Search } from 'lucide-react';
import TeamGroup from './TeamGroup';
import HierarchyNode from './HierarchyNode';
import type { HierarchyGroup, HierarchyMember, AvailableManager, OrgEditState } from './types';

interface HierarchyTreeProps {
  tree: HierarchyGroup[];
  unassigned: HierarchyMember[];
  availableManagers: AvailableManager[];
  userRole: string;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
  /** Opens AssignModal in parent for the given member */
  onAssign?: (member: HierarchyMember) => void;
  searchTerm?: string;
}

const EMPTY_EDIT: OrgEditState = { managerId: '', teamName: '', jobTitle: '' };

export default function HierarchyTree({
  tree,
  unassigned,
  availableManagers,
  userRole,
  onSaved,
  onError,
  onAssign,
  searchTerm,
}: HierarchyTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { __unassigned: true };
    tree.forEach(g => { init[g._id] = true; });
    return init;
  });

  // Auto-expand results when search is active
  useEffect(() => {
    if (searchTerm) {
      const init: Record<string, boolean> = { __unassigned: true };
      tree.forEach(g => { init[g._id] = true; });
      setExpanded(init);
    }
  }, [searchTerm, tree]);

  const [editing, setEditing]   = useState<string | null>(null);
  const [editData, setEditData] = useState<OrgEditState>(EMPTY_EDIT);
  const [saving, setSaving]     = useState(false);

  const toggle = useCallback((id: string) => {
    setExpanded(p => ({ ...p, [id]: !p[id] }));
  }, []);

  const startEdit = useCallback((member: HierarchyMember) => {
    setEditing(member._id);
    setEditData({
      managerId:  member.managerId  ?? '',
      teamName:   member.teamName   ?? '',
      jobTitle:   (member as any).jobTitle ?? '',
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setEditData(EMPTY_EDIT);
  }, []);

  const saveEdit = useCallback(async (empId: string) => {
    setSaving(true);
    try {
      const r = await fetch('/api/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: empId,
          managerId:  editData.managerId  || null,
          teamName:   editData.teamName,
        }),
      });
      const d = await r.json();
      if (d.ok) { onSaved('Saved!'); setEditing(null); setEditData(EMPTY_EDIT); }
      else onError(d.error || 'Failed to save');
    } catch { onError('Network error'); }
    setSaving(false);
  }, [editData, onSaved, onError]);

  const canEdit = userRole === 'admin';

  // Count direct reports per member for the badge on team-lead nodes
  const reportCountMap: Record<string, number> = {};
  tree.forEach(g => {
    g.reports.forEach(m => {
      const count = tree.reduce(
        (acc, grp) => acc + grp.reports.filter(r => r.managerId === m._id).length,
        0
      );
      if (count > 0) reportCountMap[m._id] = count;
    });
  });

  const renderNode = (member: HierarchyMember) => {
    if (!member) return null;
    return (
      <HierarchyNode
        key={member._id}
        member={member}
        directReportCount={reportCountMap[member._id]}
        canEdit={canEdit}
        isEditing={editing === member._id}
        editData={editing === member._id ? editData : EMPTY_EDIT}
        saving={saving}
        availableManagers={availableManagers}
        onStartEdit={() => startEdit(member)}
        onCancelEdit={cancelEdit}
        onSaveEdit={() => saveEdit(member._id)}
        onEditChange={patch => setEditData(p => ({ ...p, ...patch }))}
        onAssign={onAssign ? () => onAssign(member) : undefined}
      />
    );
  };

  const isEmpty = tree.length === 0 && unassigned.length === 0;

  return (
    <div className="space-y-3">
      {/* Manager / zone groups */}
      {tree.map(group => (
        <TeamGroup
          key={group._id}
          group={group}
          isExpanded={!!expanded[group._id]}
          onToggle={() => toggle(group._id)}
        >
          {group.reports.map(renderNode)}
        </TeamGroup>
      ))}

      {/* Unassigned employees */}
      {unassigned.length > 0 && (
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(249,115,22,0.3)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <button
            onClick={() => toggle('__unassigned')}
            className="w-full flex items-center justify-between p-4 transition hover:bg-orange-50 text-left"
            aria-expanded={!!expanded['__unassigned']}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(249,115,22,0.1)' }}
              >
                <AlertCircle className="w-4 h-4" style={{ color: '#f97316' }} />
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm">Unassigned Employees</div>
                <div className="text-[10px]" style={{ color: '#f97316' }}>
                  {unassigned.length} without a reporting manager
                  {canEdit && ' — click the assign button to build hierarchy'}
                </div>
              </div>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}
            >
              {unassigned.length}
            </span>
          </button>

          {expanded['__unassigned'] && (
            <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: '#fff7ed' }}>
              <div className="pt-3" />
              {unassigned.map(renderNode)}
            </div>
          )}
        </div>
      )}

      {/* True empty state — no employees at all or no search matches */}
      {isEmpty && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.08)' }}
          >
            {searchTerm ? <Search className="w-6 h-6 text-gray-400" /> : <UserPlus className="w-6 h-6" style={{ color: '#6366f1' }} />}
          </div>
          <p className="text-gray-700 font-semibold text-sm">
            {searchTerm ? 'No employees found for this search' : 'No employees found'}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {searchTerm ? 'Try adjusting your keywords or clearing the search' : 'Add employees from Employee Management first'}
          </p>
        </div>
      )}
    </div>
  );
}
