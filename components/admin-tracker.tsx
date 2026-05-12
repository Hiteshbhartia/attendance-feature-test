'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminTracker() {
  const router = useRouter();
  const [filters, setFilters] = useState({ date: '', role: '', team: '', status: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const defaultCheckins = [
    { key: 'G1MYT', label: 'G1MYT', range: '10:30 AM - 12:00 PM', status: 'idle', targetCount: 0 },
    { key: 'G2MYT', label: 'G2MYT', range: '12:00 PM - 2:15 PM', status: 'idle', targetCount: 0 },
    { key: 'G3MYT', label: 'G3MYT', range: '2:30 PM - 4:00 PM', status: 'idle', targetCount: 0 },
    { key: 'G4MYT', label: 'G4MYT', range: '4:00 PM - 5:35 PM', status: 'idle', targetCount: 0 },
  ];

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date) params.set('date', filters.date);
      if (filters.role) params.set('role', filters.role);

      if (filters.team) params.set('team', filters.team);
      if (filters.status) params.set('status', filters.status);
      params.set('limit', '100'); // Get more for client-side search
      const r = await fetch(`/api/tracker?${params.toString()}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) {
        setRows(d.rows || []);
        setSummary(d.summary || null);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const r = await fetch('/api/tracker/analytics', { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) setAnalytics(d);
    } catch {
      setAnalytics(null);
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setFilters(p => ({ ...p, date: today }));
    fetchAnalytics();
  }, []);

  useEffect(() => {
    if (!filters.date) return;
    fetchList();
  }, [filters.date, filters.role, filters.team, filters.status]);

  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return '#10b981'; // Green
      case 'missing': return '#ef4444'; // Red
      case 'pending': return '#f59e0b'; // Orange
      case 'edited': return '#8b5cf6'; // Violet/Purple for edited
      default: return '#6b7280';
    }
  };

  const filteredRows = rows.filter(r => 
    r.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-10">
      <div style={card} className="p-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">ARENA OS - Daily Updates</h1>
        <div className="text-xs" style={{ color: '#6b7280' }}>Track submissions across the organization</div>
      </div>

      <div style={card} className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-[11px] mb-1.5" style={{ color: '#6b7280' }}>Date</label>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters(p => ({ ...p, date: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }}
          />
        </div>
        <div>
          <label className="block text-[11px] mb-1.5" style={{ color: '#6b7280' }}>Search Employee</label>
          <input
            type="text"
            placeholder="Search name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }}
          />
        </div>
        <div>
          <label className="block text-[11px] mb-1.5" style={{ color: '#6b7280' }}>Role</label>
          <select
            value={filters.role}
            onChange={(e) => setFilters(p => ({ ...p, role: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }}
          >
            <option value="">All</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] mb-1.5" style={{ color: '#6b7280' }}>Team</label>
          <input
            value={filters.team}
            onChange={(e) => setFilters(p => ({ ...p, team: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }}
            placeholder="Filter team..."
          />
        </div>
        <div>
          <label className="block text-[11px] mb-1.5" style={{ color: '#6b7280' }}>Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters(p => ({ ...p, status: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }}
          >
            <option value="">All</option>
            <option value="submitted">Submitted</option>
            <option value="pending">Pending</option>
            <option value="missing">Missing</option>
            <option value="edited">Edited</option>
          </select>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Employees', value: summary.totalEmployees, color: '#111827' },
            { label: 'Submitted Today', value: summary.submittedToday, color: '#10b981' },
            { label: 'Missing Today', value: summary.missingToday, color: '#ef4444' },
            { label: 'Edited Today', value: summary.editedToday, color: '#8b5cf6' },
          ].map((s) => (
            <div key={s.label} style={card} className="p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value || 0}</div>
              <div className="text-[10px]" style={{ color: '#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={card} className="overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Daily Updates Submissions</h2>
          <span className="text-[10px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">{filteredRows.length} shown</span>
        </div>
        
        {loading ? (
          <div className="p-10 text-center text-xs text-gray-500">Loading submissions...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-xs text-gray-500">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Employee</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Role / Dept</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Status</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Today's Progress</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const checkins = r.tracker?.dailyCheckins?.length ? r.tracker.dailyCheckins : defaultCheckins;
                  return (
                    <tr 
                      key={r.employeeId} 
                      className="hover:bg-gray-50/50 cursor-pointer transition-colors group"
                      onClick={() => router.push(`/admin/tracker/${r.employeeId}`)}
                    >
                      <td className="px-5 py-4 border-b border-gray-50">
                        <div className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">{r.employeeName}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{r.email}</div>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-50">
                        <div className="text-[11px] font-medium text-gray-700 capitalize">{r.role}</div>
                        <div className="text-[10px] text-gray-500">{r.teamName || 'No Team'}</div>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-50">
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ 
                            background: `${getStatusColor(r.status)}15`, 
                            color: getStatusColor(r.status),
                            border: `1px solid ${getStatusColor(r.status)}30` 
                          }}
                        >
                          {r.status}
                        </span>
                        {r.tracker?.submittedAt && (
                          <div className="text-[9px] text-gray-400 mt-1 font-medium">
                            {new Date(r.tracker.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 border-b border-gray-50">
                        <div className="flex flex-wrap gap-1.5">
                          {checkins.map((c: any) => (
                            <div key={c.key} className="flex flex-col p-1.5 rounded-lg border border-gray-100 bg-white min-w-[120px]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-bold text-gray-900">{c.label}</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'completed' ? 'bg-emerald-500' : c.status === 'started' ? 'bg-orange-400' : 'bg-gray-200'}`} />
                              </div>
                              <div className="text-[8px] text-gray-400 font-medium mb-1">{c.range}</div>
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] text-gray-600 font-bold">{c.targetCount} leads</span>
                                <span className="text-[8px] text-gray-400 capitalize">{c.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div style={card} className="p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Top Consistent Submitters (30d)</h2>
            {analytics.topSubmitters?.length ? (
              <div className="space-y-2">
                {analytics.topSubmitters.map((t: any) => (
                  <div key={t.employeeId} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <span className="text-gray-900 font-semibold">{t.name}</span>
                    <span className="text-gray-600">{t.submitted} submissions</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No data yet.</div>
            )}
          </div>
          <div style={card} className="p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Repeated Missed Submissions (30d)</h2>
            {analytics.repeatMissed?.length ? (
              <div className="space-y-2">
                {analytics.repeatMissed.map((t: any) => (
                  <div key={t.employeeId} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <span className="text-gray-900 font-semibold">{t.name}</span>
                    <span className="text-gray-600">{t.missed} missed</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No data yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
