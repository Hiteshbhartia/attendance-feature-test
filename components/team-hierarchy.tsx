'use client';
// ─── Phase 1-4 upgrade: modular hierarchy tree ───────────────────────────────
// Sub-components live in components/hierarchy/
// This file is now a thin orchestrator: data fetching + state + layout only.
import { useEffect, useState, useCallback, useMemo } from 'react';
import { GitBranch, Plus, RefreshCw, Check, AlertCircle, Search, X } from 'lucide-react';

import HierarchyTree from './hierarchy/HierarchyTree';
import AssignModal from './hierarchy/AssignModal';
import AddMemberModal from './hierarchy/AddMemberModal';
import RoleBadge from './hierarchy/RoleBadge';

// Import newly created management components
import OrgEntityManager from './org-entity-manager';
import HierarchyRoleManager from './hierarchy/HierarchyRoleManager';
import PermissionMatrix from './hierarchy/PermissionMatrix';

import type {
  OrgApiResponse,
  HierarchyGroup,
  HierarchyMember,
  AvailableManager,
  HierarchyRoleDef,
} from './hierarchy/types';

export default function TeamHierarchy() {
  const [tree, setTree]             = useState<HierarchyGroup[]>([]);
  const [unassigned, setUnassigned] = useState<HierarchyMember[]>([]);
  const [managers, setManagers]     = useState<AvailableManager[]>([]);
  const [hierarchyRoles, setHierarchyRoles] = useState<HierarchyRoleDef[]>([]);
  const [groupedByZone, setGroupedByZone]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [userRole, setUserRole] = useState('');
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);

  // Modal state
  const [showAdd,    setShowAdd]    = useState(false);
  const [assignTarget, setAssignTarget] = useState<HierarchyMember | null>(null);

  // Manager filter (admin only)
  const [managerFilter, setManagerFilter] = useState('');
  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Tabs state
  const [activeTab, setActiveTab] = useState<'tree' | 'teams' | 'roles' | 'permissions'>('tree');

  const flash = useCallback((text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  }, []);

  const fetchOrg = useCallback(() => {
    setLoading(true);
    fetch('/api/org', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: OrgApiResponse) => {
        if (d.tree)             setTree(d.tree);
        if (d.unassigned)       setUnassigned(d.unassigned);
        if (d.availableManagers) setManagers(d.availableManagers);
        if (d.groupedByZone !== undefined) setGroupedByZone(d.groupedByZone);
      })
      .catch(() => flash('Failed to load hierarchy', false))
      .finally(() => setLoading(false));
  }, [flash]);

  // Fetch hierarchy role definitions (for AssignModal)
  const fetchHierarchyRoles = useCallback(() => {
    fetch('/api/hierarchy/roles')
      .then(r => r.json())
      .then(d => { if (d.roles) setHierarchyRoles(d.roles); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchOrg();
    fetchHierarchyRoles();
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d?.role) setUserRole(d.role); })
      .catch(() => {});
  }, [fetchOrg, fetchHierarchyRoles]);

  // Memoized filtering logic
  const filteredData = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase().trim();
    
    // 1. Filter tree
    let filteredTree = tree;
    if (managerFilter) {
      filteredTree = tree.filter(g => g._id === managerFilter);
    }

    if (lowerSearch) {
      filteredTree = filteredTree.map(group => {
        const matchesGroup = (
          group.fullName.toLowerCase().includes(lowerSearch) ||
          group.email.toLowerCase().includes(lowerSearch) ||
          group.team?.toLowerCase().includes(lowerSearch) ||
          group.hierarchyRole?.name.toLowerCase().includes(lowerSearch)
        );

        const matchingReports = group.reports.filter(m => 
          m.fullName.toLowerCase().includes(lowerSearch) ||
          m.email.toLowerCase().includes(lowerSearch) ||
          m.teamName?.toLowerCase().includes(lowerSearch) ||
          m.hierarchyRole?.name.toLowerCase().includes(lowerSearch)
        );

        if (matchesGroup || matchingReports.length > 0) {
          return { ...group, reports: matchingReports };
        }
        return null;
      }).filter(Boolean) as HierarchyGroup[];
    }

    // 2. Filter unassigned
    let filteredUnassigned = unassigned;
    if (lowerSearch) {
      filteredUnassigned = unassigned.filter(m => 
        m.fullName.toLowerCase().includes(lowerSearch) ||
        m.email.toLowerCase().includes(lowerSearch) ||
        m.teamName?.toLowerCase().includes(lowerSearch) ||
        m.hierarchyRole?.name.toLowerCase().includes(lowerSearch)
      );
    }

    return { filteredTree, filteredUnassigned };
  }, [tree, unassigned, searchTerm, managerFilter]);

  const { filteredTree, filteredUnassigned } = filteredData;
  const isAdminUser = userRole === 'admin';

  return (
    <div className="space-y-4">
      {/* ── Header card ── */}
      <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)' }}>
              <GitBranch className="w-5 h-5" style={{ color: '#6366f1' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Organization Architecture</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? 'Refreshing data...' :
                  activeTab === 'tree' ? (groupedByZone ? 'Grouped by zone — assign managers to build the tree' : `${tree.length} reporting groups · ${unassigned.length} unassigned`) :
                  activeTab === 'teams' ? 'Manage operational teams and KPI grouping' :
                  activeTab === 'roles' ? 'Define hierarchy authority levels and permissions' :
                  'Global permission and capability overview'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrg}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {activeTab === 'tree' && isAdminUser && unassigned.length > 0 && (
              <button
                onClick={() => setAssignTarget(unassigned[0])}
                className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold text-white transition bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
              >
                <Plus className="w-3.5 h-3.5" />
                Build Tree
              </button>
            )}
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="mt-6 flex items-center gap-1 p-1 bg-gray-50 rounded-2xl w-fit">
          {[
            { id: 'tree', label: 'Organization Tree', icon: GitBranch },
            { id: 'teams', label: 'Teams', icon: Plus },
            { id: 'roles', label: 'Hierarchy Roles', icon: Shield, adminOnly: true },
            { id: 'permissions', label: 'Permissions', icon: Check, adminOnly: true },
          ].map(tab => {
            if (tab.adminOnly && !isAdminUser) return null;
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  active 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'tree' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="bg-white rounded-3xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text"
                  placeholder="Search employees, teams, or hierarchy roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-10 pr-10 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-lg hover:bg-gray-200 transition"
                  >
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>

              {!groupedByZone && managers.length > 1 && isAdminUser && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Focus Manager:</span>
                  <select
                    value={managerFilter}
                    onChange={e => setManagerFilter(e.target.value)}
                    className="h-10 px-3 rounded-xl text-xs font-bold focus:outline-none bg-gray-50 border border-gray-100 text-gray-700 min-w-[140px]"
                  >
                    <option value="">All Managers</option>
                    {managers.map(m => (
                      <option key={m._id} value={m._id}>{m.fullName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-3xl bg-white border border-gray-100" />)}
              </div>
            ) : (
              <HierarchyTree
                tree={filteredTree}
                unassigned={filteredUnassigned}
                searchTerm={searchTerm}
                availableManagers={managers}
                userRole={userRole}
                onSaved={(m) => { flash(m, true); fetchOrg(); }}
                onError={(m) => flash(m, false)}
                onAssign={isAdminUser ? (member) => setAssignTarget(member) : undefined}
              />
            )}
          </div>
        )}

        {activeTab === 'teams' && isAdminUser && (
          <OrgEntityManager 
            entityType="team" 
            apiPath="/api/teams" 
            label="Team" 
            examples={['HR Team', 'Recruitment', 'Backend Engineering', 'Customer Success']}
          />
        )}

        {activeTab === 'roles' && isAdminUser && (
          <HierarchyRoleManager />
        )}

        {activeTab === 'permissions' && isAdminUser && (
          <PermissionMatrix />
        )}
      </div>

      {/* ── Modals ── */}
      {assignTarget && (
        <AssignModal
          member={assignTarget}
          hierarchyRoles={hierarchyRoles}
          availableManagers={managers}
          onClose={() => setAssignTarget(null)}
          onSaved={(m) => { flash(m, true); setAssignTarget(null); fetchOrg(); }}
          onError={(m) => flash(m, false)}
        />
      )}

      {/* Flash message */}
      {msg && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-5 duration-300">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold shadow-xl border"
            style={{
              background: msg.ok ? '#ffffff' : '#fff1f2',
              borderColor: msg.ok ? '#ecfdf5' : '#fee2e2',
              color: msg.ok ? '#059669' : '#e11d48',
            }}
          >
            {msg.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons for tabs ──
function Shield(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
  );
}
