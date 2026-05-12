'use client';
import { useState, useEffect } from 'react';
import { X, Check, AlertCircle, UserMinus } from 'lucide-react';
import { avColor, initials } from './avatar';
import type { HierarchyMember, HierarchyRoleDef, AvailableManager } from './types';

interface OrgOption { _id: string; name: string; color: string; }

interface AssignModalProps {
  member: HierarchyMember;
  hierarchyRoles: HierarchyRoleDef[];
  availableManagers: AvailableManager[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function AssignModal({
  member,
  hierarchyRoles,
  availableManagers,
  onClose,
  onSaved,
  onError,
}: AssignModalProps) {
  const [hierarchyRoleId, setHierarchyRoleId] = useState(member.hierarchyRole?._id ?? '');
  const [managerId,       setManagerId]       = useState(member.managerId ?? '');
  const [teamName,        setTeamName]        = useState(member.teamName ?? '');
  const [officeZoneId,     setOfficeZoneId]    = useState(member.officeZoneId ?? '');
  const [jobTitle,        setJobTitle]        = useState((member as any).jobTitle ?? '');
  const [saving,          setSaving]          = useState(false);
  const [removing,        setRemoving]        = useState(false);

  // Centralized data from API
  const [teams,       setTeams]       = useState<OrgOption[]>([]);
  const [zones,       setZones]       = useState<OrgOption[]>([]);
  const [loadingOrg,  setLoadingOrg]  = useState(true);

  useEffect(() => {
    setLoadingOrg(true);
    Promise.all([
      fetch('/api/teams').then(r => r.json()),
      fetch('/api/zones').then(r => r.json())
    ]).then(([td, zd]) => {
      if (td.teams) setTeams(td.teams);
      if (zd.zones) setZones(zd.zones);
    }).catch(() => {})
    .finally(() => setLoadingOrg(false));
  }, []);

  // Prevent self-reporting
  const safeManagers = availableManagers.filter(m => m._id !== member._id);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Find the actual team object to get the teamId if possible
      const selectedTeam = teams.find(t => t.name === teamName);

      // 1. Unified assignment call (role + manager + team + jobTitle)
      const res = await fetch('/api/hierarchy/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId:      member._id,
          hierarchyRoleId: hierarchyRoleId || null,
          managerId:       managerId       || null,
          teamId:          selectedTeam?._id || null,
          teamName:        teamName,
          officeZoneId:    officeZoneId || null,
          jobTitle:        (jobTitle || '').trim(),
        }),
      });
      
      const data = await res.json();
      if (!data.ok) { 
        onError(data.error || 'Failed to save changes'); 
        setSaving(false); 
        return; 
      }

      onSaved(`${member.fullName} updated`);
      onClose();
    } catch {
      onError('Network error');
    }
    setSaving(false);
  };

  const handleRemoveManager = async () => {
    setRemoving(true);
    try {
      const r = await fetch('/api/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: member._id, managerId: null }),
      });
      const d = await r.json();
      if (d.ok) { onSaved(`${member.fullName} unassigned`); onClose(); }
      else onError(d.error || 'Failed');
    } catch { onError('Network error'); }
    setRemoving(false);
  };

  const color = avColor(member.fullName);
  const ini   = initials(member.fullName);

  const teamOptions = teams.some(t => t.name === teamName)
    ? teams
    : teamName
      ? [{ _id: '__legacy__', name: teamName, color: '#6b7280' }, ...teams]
      : teams;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-gray-200 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: color }}
            >
              {ini}
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">{member.fullName}</div>
              <div className="text-xs text-gray-400">{member.email}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">

          {/* Hierarchy Role */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Hierarchy Role
            </label>
            <select
              value={hierarchyRoleId}
              onChange={e => setHierarchyRoleId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">— No Role —</option>
              {hierarchyRoles.map(r => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
            {hierarchyRoles.length === 0 && (
              <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                No roles yet — seed defaults via POST /api/hierarchy/seed
              </p>
            )}
          </div>

          {/* Reports To */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Reports To
            </label>
            <select
              value={managerId}
              onChange={e => setManagerId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">— No Manager —</option>
              {safeManagers.map(m => (
                <option key={m._id} value={m._id}>
                  {m.fullName} ({m.hierarchyRole?.name ?? m.role})
                </option>
              ))}
            </select>
            {member.managerId && (
              <button
                onClick={handleRemoveManager}
                disabled={removing}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600 transition disabled:opacity-50"
              >
                <UserMinus className="w-3 h-3" />
                {removing ? 'Removing…' : 'Remove current manager'}
              </button>
            )}
          </div>

          {/* Team — dropdown from /api/teams */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Operational Team
            </label>
            {loadingOrg ? (
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            ) : (
              <select
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— No Team —</option>
                {teamOptions.map(t => (
                  <option key={t._id} value={t.name}>
                    {t.name}{t._id === '__legacy__' ? ' (legacy)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Office Zone — dropdown from /api/zones */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Office Zone (Physical Location)
            </label>
            {loadingOrg ? (
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            ) : (
              <select
                value={officeZoneId}
                onChange={e => setOfficeZoneId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— No Zone —</option>
                {zones.map(z => (
                  <option key={z._id} value={z._id}>
                    {z.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Job Title — display designation, separate from hierarchy role */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Job Title
              <span className="ml-1 text-[9px] font-normal text-gray-400 normal-case">(display only, not a permission role)</span>
            </label>
            <input
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g. HR Executive, Senior Recruiter, Engineering Lead"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white transition disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: '#6366f1' }}
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Check className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
