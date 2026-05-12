'use client';
import { useState, useEffect } from 'react';
import { Check, X, Shield, Info } from 'lucide-react';
import { DEFAULT_HIERARCHY_CAPABILITIES } from './types';

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
  color: string;
  capabilities: PermissionSet;
}

const PERMISSION_KEYS: (keyof PermissionSet)[] = [
  'canViewKPIs',
  'canEditKPIs',
  'canCreateKPIs',
  'canViewAttendance',
  'canEditAttendance',
  'canConduct1on1s',
  'canManageReports',
  'canApproveRequests',
  'canViewTeamDashboards',
];

const PERMISSION_SHORT_LABELS: Record<keyof PermissionSet, string> = {
  canViewKPIs:          'View KPIs',
  canEditKPIs:          'Edit KPIs',
  canCreateKPIs:        'Create KPIs',
  canViewAttendance:    'View Attendance',
  canEditAttendance:    'Edit Attendance',
  canConduct1on1s:   'Conduct 1:1s',
  canManageReports:     'Manage Reports',
  canApproveRequests:   'Approve Requests',
  canViewTeamDashboards: 'Team Dashboards',
};

export default function PermissionMatrix() {
  const [roles, setRoles] = useState<HierarchyRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/hierarchy/roles')
      .then(r => r.json())
      .then(d => { if (d.roles) setRoles(d.roles); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center animate-pulse">Loading Matrix...</div>;

  return (
    <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-6 border-b bg-gray-50/50">
        <h3 className="text-sm font-bold text-gray-900">Permission Matrix</h3>
        <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider font-semibold">Cross-role capability comparison</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white">
              <th className="p-4 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky left-0 bg-white z-10">Capability</th>
              {roles.map(role => (
                <th key={role._id} className="p-4 border-b border-gray-100 text-center min-w-[100px]">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: role.color }} />
                    <span className="text-[10px] font-bold text-gray-900">{role.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {PERMISSION_KEYS.map(key => (
              <tr key={key} className="hover:bg-gray-50/50 transition">
                <td className="p-4 sticky left-0 bg-white z-10 border-r border-gray-50">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-700">{PERMISSION_SHORT_LABELS[key]}</span>
                  </div>
                </td>
                {roles.map(role => {
                  const caps = role.capabilities || DEFAULT_HIERARCHY_CAPABILITIES;
                  const has = caps[key];
                  return (
                    <td key={role._id} className="p-4 text-center">
                      <div className="flex justify-center">
                        {has ? (
                          <div className="w-6 h-6 rounded-lg bg-green-50 flex items-center justify-center border border-green-100 shadow-sm transition-all hover:scale-110">
                            <Check className="w-3.5 h-3.5 text-green-600 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 transition-all hover:scale-110">
                            <X className="w-3.5 h-3.5 text-gray-300" />
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t bg-indigo-50/30 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-indigo-400" />
        <p className="text-[10px] text-indigo-500 font-medium">This matrix reflects the active configuration for all hierarchy levels. Changes in "Hierarchy Roles" tab will update this table automatically.</p>
      </div>
    </div>
  );
}
