'use client';
import { useEffect, useState } from 'react';
import { Users, ChevronDown, ChevronRight, Edit2, Check, X, AlertCircle, MapPin, UserCheck } from 'lucide-react';

interface OrgEmployee {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  teamName: string;
  team: string;
  jobRole: string;
  isApproved: boolean;
}

interface OrgGroup {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  team: string;
  groupType: 'manager' | 'zone';
  reports: OrgEmployee[];
}

interface AvailableManager {
  _id: string;
  fullName: string;
  email: string;
  role: string;
}

const COLORS = ['bg-blue-200','bg-purple-200','bg-yellow-200','bg-green-200','bg-pink-200','bg-orange-200'];
const TEXT   = ['text-blue-700','text-purple-700','text-yellow-700','text-green-700','text-pink-700','text-orange-700'];

function colorIdx(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % COLORS.length;
  return h;
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function OrgStructure() {
  const [tree, setTree]                   = useState<OrgGroup[]>([]);
  const [unassigned, setUnassigned]       = useState<OrgEmployee[]>([]);
  const [availableManagers, setAvailableManagers] = useState<AvailableManager[]>([]);
  const [groupedByZone, setGroupedByZone] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [expanded, setExpanded]           = useState<Record<string, boolean>>({});
  const [editing, setEditing]             = useState<string | null>(null);
  const [editData, setEditData]           = useState({ managerId: '', teamName: '' });
  const [saving, setSaving]               = useState(false);
  const [msg, setMsg]                     = useState<{ text: string; ok: boolean } | null>(null);

  const fetchOrg = () => {
    setLoading(true);
    fetch('/api/org', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.tree)               setTree(d.tree);
        if (d.unassigned)         setUnassigned(d.unassigned);
        if (d.availableManagers)  setAvailableManagers(d.availableManagers);
        if (d.groupedByZone !== undefined) setGroupedByZone(d.groupedByZone);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrg(); }, []);

  // Auto-expand all groups when data loads
  useEffect(() => {
    if (tree.length > 0 || unassigned.length > 0) {
      const exp: Record<string, boolean> = { unassigned: true };
      tree.forEach(g => { exp[g._id] = true; });
      setExpanded(exp);
    }
  }, [tree, unassigned]);

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const startEdit = (emp: OrgEmployee) => {
    setEditing(emp._id);
    setEditData({ managerId: '', teamName: emp.teamName || '' });
  };

  const saveEdit = async (empId: string) => {
    setSaving(true);
    try {
      const r = await fetch('/api/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: empId,
          managerId:  editData.managerId || null,
          teamName:   editData.teamName,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        flash('Saved!', true);
        setEditing(null);
        fetchOrg();
      } else {
        flash(d.error || 'Failed', false);
      }
    } catch {
      flash('Network error', false);
    }
    setSaving(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const EmployeeCard = ({ emp }: { emp: OrgEmployee }) => {
    const ci        = colorIdx(emp.fullName);
    const isEditing = editing === emp._id;

    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-orange-200 transition">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-full ${COLORS[ci]} flex items-center justify-center text-xs font-bold ${TEXT[ci]} flex-shrink-0`}>
              {initials(emp.fullName)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{emp.fullName}</p>
              <p className="text-xs text-gray-400 truncate">{emp.team}</p>
              {!isEditing && emp.teamName && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{emp.teamName}</span>
                </div>
              )}
            </div>
          </div>

          {!isEditing ? (
            <button onClick={() => startEdit(emp)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-orange-500 transition flex-shrink-0">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => saveEdit(emp._id)} disabled={saving}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition disabled:opacity-50">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditing(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="mt-3 space-y-2 pt-3 border-t border-gray-100">
            {availableManagers.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-1 block">Reports To</label>
                <select value={editData.managerId}
                  onChange={e => setEditData(p => ({ ...p, managerId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">€” No Manager €”</option>
                  {availableManagers.map(mgr => (
                    <option key={mgr._id} value={mgr._id}>{mgr.fullName} ({mgr.role})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-1 block">Team Name</label>
                <input value={editData.teamName}
                  onChange={e => setEditData(p => ({ ...p, teamName: e.target.value }))}
                  placeholder="e.g. Tech Team"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Org Structure</h2>
            <p className="text-xs text-gray-700 mt-0.5">
              {groupedByZone
                ? 'Employees grouped by zone  -  Assign team names below'
                : 'Employees grouped by manager'}
            </p>
          </div>
        </div>
        {groupedByZone && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-xs text-blue-700">
            No managers assigned yet — showing employees by zone. Click 🖊️ on any employee to assign team info.
          </div>
        )}
      </div>

      {/* Flash */}
      {msg && (
        <div className={`flex items-center gap-2 p-4 rounded-2xl text-sm font-medium border ${
          msg.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {msg.ok ? <UserCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-white border border-gray-200 rounded-3xl"/>)}
        </div>
      ) : tree.length === 0 && unassigned.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
          <p className="text-gray-400">No employees found</p>
        </div>
      ) : (
        <>
          {tree.map(group => (
            <div key={group._id} className="bg-white border border-gray-200 rounded-3xl overflow-hidden">
              <button onClick={() => toggleExpand(group._id)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    group.groupType === 'zone'
                      ? 'bg-orange-100'
                      : `${COLORS[colorIdx(group.fullName)]}`
                  }`}>
                    {group.groupType === 'zone'
                      ? <MapPin className="w-5 h-5 text-orange-500" />
                      : <span className={`text-sm font-bold ${TEXT[colorIdx(group.fullName)]}`}>{initials(group.fullName)}</span>
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-800">{group.fullName}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        group.role === 'admin'   ? 'bg-red-100 text-red-700' :
                        group.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>{group.role === 'zone' ? 'Zone' : group.role}</span>
                    </div>
                    <p className="text-xs text-gray-400">{group.reports.length} employees</p>
                  </div>
                </div>
                {expanded[group._id]
                  ? <ChevronDown className="w-5 h-5 text-gray-400" />
                  : <ChevronRight className="w-5 h-5 text-gray-400" />}
              </button>

              {expanded[group._id] && (
                <div className="px-5 pb-5 space-y-2 border-t border-gray-100 pt-4">
                  {group.reports.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No employees in this group</p>
                  ) : group.reports.map(emp => (
                    <EmployeeCard key={emp._id} emp={emp} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {unassigned.length > 0 && (
            <div className="bg-white border border-orange-200 rounded-3xl overflow-hidden">
              <button onClick={() => toggleExpand('unassigned')}
                className="w-full flex items-center justify-between p-5 hover:bg-orange-50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">Unassigned</p>
                    <p className="text-xs text-orange-500">{unassigned.length} employees without a manager</p>
                  </div>
                </div>
                {expanded['unassigned']
                  ? <ChevronDown className="w-5 h-5 text-gray-400" />
                  : <ChevronRight className="w-5 h-5 text-gray-400" />}
              </button>

              {expanded['unassigned'] && (
                <div className="px-5 pb-5 space-y-2 border-t border-orange-100 pt-4">
                  {unassigned.map(emp => <EmployeeCard key={emp._id} emp={emp} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
