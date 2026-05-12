'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, Shield, Lock, Settings2 } from 'lucide-react';
import RoleBadge from './RoleBadge';
import { DEFAULT_HIERARCHY_CAPABILITIES, getDefaultCapabilitiesForTier } from './types';

interface PermissionSet {
  canViewKPIs: boolean;
  canEditKPIs: boolean;
  canCreateKPIs: boolean;
  canViewAttendance: boolean;
  canEditAttendance: boolean;
  canConduct1on1s: boolean;
  canManageReports: boolean;
  canApproveRequests: boolean;
  canViewTeamDashboards: boolean;
}

interface HierarchyRole {
  _id: string;
  name: string;
  slug: string;
  systemRole: 'admin' | 'manager' | 'team_lead' | 'hr' | 'employee';
  level: number;
  color: string;
  isActive: boolean;
  capabilities: PermissionSet;
}

const slugify = (text: any) => {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w-]+/g, '')   // Remove all non-word chars
    .replace(/--+/g, '-');     // Replace multiple - with single -
};

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#6b7280',
];

const PERMISSION_LABELS: Record<keyof PermissionSet, { label: string; desc: string }> = {
  canViewKPIs:          { label: 'View KPIs',           desc: 'View personal and team performance metrics' },
  canEditKPIs:          { label: 'Edit KPIs',           desc: 'Modify existing KPI values and targets' },
  canCreateKPIs:        { label: 'Create KPIs',         desc: 'Define new performance indicators' },
  canViewAttendance:    { label: 'View Attendance',     desc: 'View check-in/out times and live status' },
  canEditAttendance:    { label: 'Edit Attendance',     desc: 'Correct attendance logs and shift schedules' },
  canConduct1on1s:        { label: 'Conduct 1:1s',        desc: 'Schedule and host coaching sessions' },
  canManageReports:     { label: 'Manage Reports',      desc: 'Assign managers and manage reporting structure' },
  canApproveRequests:   { label: 'Approve Requests',    desc: 'Approve or reject leave/correction requests' },
  canViewTeamDashboards: { label: 'View Team Dashboards', desc: 'Access aggregated team performance views' },
};

export default function HierarchyRoleManager() {
  const [roles, setRoles] = useState<HierarchyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<HierarchyRole | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/hierarchy/roles');
      const d = await r.json();
      if (d.roles) setRoles(d.roles);
    } catch (e) {
      console.error('Failed to fetch roles', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleSave = async (role: Partial<HierarchyRole>) => {
    const roleName = (role.name || '').trim();
    if (!roleName) return alert('Name is required');
    if (!role.systemRole) return alert('System role is required');

    setSaving(true);
    try {
      const isNew = !role._id;
      
      if (!isNew && !role._id) {
        alert('Unable to update role: missing role ID');
        setSaving(false);
        return;
      }

      const payload = {
        ...role,
        name: roleName,
        slug: (role.slug || slugify(roleName)).trim(),
        color: role.color || '#6b7280',
        capabilities: role.capabilities || DEFAULT_HIERARCHY_CAPABILITIES,
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('[HierarchyRoleManager] Saving capabilities:', payload.capabilities);
        if (!isNew) console.log('[HierarchyRoleManager] Editing role ID:', role._id);
      }

      const url = isNew ? '/api/hierarchy/roles' : `/api/hierarchy/roles/${role._id}`;
      const method = isNew ? 'POST' : 'PATCH';
      
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.ok) {
        setEditingRole(null);
        setShowCreate(false);
        fetchRoles();
      } else {
        alert(d.error || 'Failed to save role');
      }
    } catch (e) {
      alert('Network error');
    }
    setSaving(false);
  };

  const renderCapabilityToggle = (role: HierarchyRole, key: keyof PermissionSet) => {
    const caps = role.capabilities || DEFAULT_HIERARCHY_CAPABILITIES;
    const val = caps[key];
    return (
      <label key={key} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition cursor-pointer group">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-gray-800">{PERMISSION_LABELS[key].label}</span>
          <span className="text-[9px] text-gray-400 group-hover:text-gray-500">{PERMISSION_LABELS[key].desc}</span>
        </div>
        <input
          type="checkbox"
          checked={val}
          onChange={(e) => {
            const updated = { ...role };
            updated.capabilities = { ...(updated.capabilities || DEFAULT_HIERARCHY_CAPABILITIES), [key]: e.target.checked };
            setEditingRole(updated);
          }}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
        />
      </label>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Role List ── */}
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Hierarchy Roles</h3>
            <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider font-semibold">Permission tiers & authority definitions</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition bg-indigo-600 hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            New Role
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-10 text-center animate-pulse space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-2xl mx-auto max-w-md" />)}
            </div>
          ) : roles.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-xs italic">No roles defined yet</div>
          ) : (
            roles.map(role => (
              <div key={role._id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center border-2" style={{ borderColor: role.color + '20', background: role.color + '08' }}>
                    <Shield className="w-4 h-4" style={{ color: role.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{role.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-bold uppercase tracking-tight">{role.systemRole}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1 mr-2">
                    {Object.entries(role.capabilities || DEFAULT_HIERARCHY_CAPABILITIES)
                      .filter(([_, val]) => val)
                      .slice(0, 3)
                      .map(([key]) => (
                        <div key={key} className="w-5 h-5 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center">
                          <Lock className="w-2 h-2 text-indigo-500" />
                        </div>
                      ))}
                    {Object.values(role.capabilities || DEFAULT_HIERARCHY_CAPABILITIES).filter(Boolean).length > 3 && (
                      <div className="w-5 h-5 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-500">
                        +{Object.values(role.capabilities || DEFAULT_HIERARCHY_CAPABILITIES).filter(Boolean).length - 3}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingRole(role)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-100 hover:bg-white hover:shadow-sm text-gray-400 hover:text-indigo-600 transition"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Edit / Create Modal ── */}
      {(editingRole || showCreate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{showCreate ? 'Create Hierarchy Role' : `Edit Role: ${editingRole?.name}`}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider font-semibold">Define capabilities and system tier</p>
              </div>
              <button onClick={() => { setEditingRole(null); setShowCreate(false); }} className="p-2 rounded-xl hover:bg-gray-100 transition">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1">Role Name</label>
                  <input
                    value={editingRole?.name || ''}
                    onChange={e => setEditingRole(p => ({ ...p!, name: e.target.value }))}
                    placeholder="e.g. Regional Manager"
                    className="w-full h-11 px-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1">System Tier</label>
                  <select
                    value={editingRole?.systemRole || 'employee'}
                    onChange={e => {
                      const tier = e.target.value as any;
                      setEditingRole(p => ({ 
                        ...p!, 
                        systemRole: tier,
                        capabilities: getDefaultCapabilitiesForTier(tier) as any
                      }));
                    }}
                    className="w-full h-11 px-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="team_lead">Team Lead</option>
                    <option value="hr">HR</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>
              </div>

              {/* Color & Description */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1">Badge Color</label>
                  <div className="flex gap-2.5 flex-wrap px-1">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditingRole(p => ({ ...p!, color: c }))}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          (editingRole?.color || '#6b7280') === c ? 'border-white ring-2 ring-indigo-500 scale-110' : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Permissions Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Capabilities</label>
                  </div>
                  <span className="text-[9px] text-gray-400 italic">Auto-suggested based on tier & customizable</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(editingRole || showCreate) && Object.keys(PERMISSION_LABELS).map(key => 
                    renderCapabilityToggle((editingRole || { capabilities: DEFAULT_HIERARCHY_CAPABILITIES }) as HierarchyRole, key as keyof PermissionSet)
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  if (showCreate && !editingRole) {
                    handleSave({
                      name: 'New Role',
                      systemRole: 'employee',
                      level: 4,
                      color: '#6b7280',
                      isActive: true,
                      capabilities: DEFAULT_HIERARCHY_CAPABILITIES
                    });
                  } else {
                    handleSave(editingRole!);
                  }
                }}
                disabled={saving || !editingRole || !(editingRole.name || '').trim()}
                className="flex-1 h-12 flex items-center justify-center rounded-2xl text-sm font-bold text-white transition bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-200"
              >
                {saving ? 'Saving...' : 'Save Hierarchy Role'}
              </button>
              <button
                onClick={() => { setEditingRole(null); setShowCreate(false); }}
                className="px-6 h-12 rounded-2xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
