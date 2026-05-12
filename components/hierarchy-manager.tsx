'use client';
/**
 * components/hierarchy-manager.tsx
 *
 * Admin UI for managing hierarchy roles and assigning them to employees.
 * Replaces hardcoded role checks with configurable hierarchy roles.
 *
 * Features:
 * - View all hierarchy role definitions
 * - Assign hierarchy role + reporting manager to any employee
 * - Scoped: managers see only their team; admins see all
 */

import { useEffect, useState } from 'react';
import { Users, ChevronDown, Shield, GitBranch, Check, X, AlertCircle } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface HierarchyRole {
  _id: string;
  name: string;
  slug: string;
  systemRole: string;
  level: number;
  color: string;
  canManageTeam: boolean;
  canBeReportedTo: boolean;
}

interface Employee {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  systemRole?: string;
  hierarchyRoleId?: { _id: string; name: string; color: string } | null;
  managerId?: string | null;
  teamName?: string;
  department?: string;
}

interface Manager {
  _id: string;
  fullName: string;
  email: string;
  role: string;
}

const AVATAR_COLORS = ['#f97316', '#6366f1', '#10b981', '#a855f7', '#f59e0b', '#ef4444'];
function avColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 6;
  return AVATAR_COLORS[h];
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function HierarchyManager() {
  const { can, loading: permLoading } = usePermissions();

  const [hierarchyRoles, setHierarchyRoles] = useState<HierarchyRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Assignment state
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    hierarchyRoleId: '',
    managerId: '',
  });
  const [saving, setSaving] = useState(false);

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, empRes, orgRes] = await Promise.all([
        fetch('/api/hierarchy/roles'),
        fetch('/api/employees?limit=100'),
        fetch('/api/org'),
      ]);
      const [rolesData, empData, orgData] = await Promise.all([
        rolesRes.json(),
        empRes.json(),
        orgRes.json(),
      ]);
      if (rolesData.roles) setHierarchyRoles(rolesData.roles);
      if (empData.users) setEmployees(empData.users);
      if (orgData.availableManagers) setManagers(orgData.availableManagers);
    } catch {
      flash('Failed to load data', false);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const startEdit = (emp: Employee) => {
    setEditing(emp._id);
    setEditData({
      hierarchyRoleId: emp.hierarchyRoleId?._id ?? '',
      managerId: emp.managerId ?? '',
    });
  };

  const saveAssignment = async (empId: string) => {
    setSaving(true);
    try {
      const r = await fetch('/api/hierarchy/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: empId,
          hierarchyRoleId: editData.hierarchyRoleId || null,
          managerId: editData.managerId || null,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        flash('Assignment saved', true);
        setEditing(null);
        fetchData();
      } else {
        flash(d.error || 'Failed to save', false);
      }
    } catch {
      flash('Network error', false);
    }
    setSaving(false);
  };

  if (permLoading) return null;
  if (!can('MANAGE_TEAM') && !can('ASSIGN_MANAGER')) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
        You don't have permission to manage hierarchy assignments.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Hierarchy Manager</h2>
            <p className="text-xs text-gray-500">Assign roles and reporting structure to employees</p>
          </div>
        </div>

        {/* Role legend */}
        {hierarchyRoles.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {hierarchyRoles.map(r => (
              <span
                key={r._id}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: `${r.color}20`, color: r.color }}
              >
                {r.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Flash message */}
      {msg && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium border"
          style={{
            background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            borderColor: msg.ok ? '#10b981' : '#ef4444',
            color: msg.ok ? '#10b981' : '#ef4444',
          }}
        >
          {msg.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* Employee list */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-white border border-gray-200 rounded-2xl" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No employees found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map(emp => {
            const isEditing = editing === emp._id;
            const roleObj = hierarchyRoles.find(r => r._id === emp.hierarchyRoleId?._id);

            return (
              <div
                key={emp._id}
                className="bg-white border border-gray-200 rounded-2xl p-4 transition hover:border-indigo-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: avColor(emp.fullName) }}
                    >
                      {initials(emp.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{emp.fullName}</p>
                      <p className="text-xs text-gray-400 truncate">{emp.email}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {/* Current hierarchy role badge */}
                        {emp.hierarchyRoleId ? (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: `${emp.hierarchyRoleId.color ?? '#6b7280'}20`,
                              color: emp.hierarchyRoleId.color ?? '#6b7280',
                            }}
                          >
                            {emp.hierarchyRoleId.name}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                            No role assigned
                          </span>
                        )}
                        {/* Legacy role badge */}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {emp.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isEditing ? (
                    <button
                      onClick={() => startEdit(emp)}
                      className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition flex-shrink-0"
                    >
                      Assign
                    </button>
                  ) : (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => saveAssignment(emp._id)}
                        disabled={saving}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1 block">
                        Hierarchy Role
                      </label>
                      <select
                        value={editData.hierarchyRoleId}
                        onChange={e => setEditData(p => ({ ...p, hierarchyRoleId: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="">— No Role —</option>
                        {hierarchyRoles.map(r => (
                          <option key={r._id} value={r._id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1 block">
                        Reports To
                      </label>
                      <select
                        value={editData.managerId}
                        onChange={e => setEditData(p => ({ ...p, managerId: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="">— No Manager —</option>
                        {managers.map(m => (
                          <option key={m._id} value={m._id}>
                            {m.fullName} ({m.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
