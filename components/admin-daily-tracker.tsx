'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { getCurrentWeekInfo } from '@/lib/week-utils';

export default function AdminWeeklyTracker() {
  const router = useRouter();
  const now = getCurrentWeekInfo();
  const [filters, setFilters] = useState({
    year: now.year,
    week: now.weekNumber,
    employeeId: '',
    role: '',
    team: '',
    status: '',
  });
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('year', String(filters.year));
      params.set('week', String(filters.week));
      if (filters.employeeId) params.set('employeeId', filters.employeeId);
      if (filters.role) params.set('role', filters.role);

      if (filters.team) params.set('team', filters.team);
      if (filters.status) params.set('status', filters.status);
      const r = await fetch(`/api/tracker/weekly?${params.toString()}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) {
        setRows(d.rows || []);
        setSummary(d.summary || null);
      }
    } catch {
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const params = new URLSearchParams();
      params.set('year', String(filters.year));
      params.set('week', String(filters.week));
      const r = await fetch(`/api/tracker/weekly/analytics?${params.toString()}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) setAnalytics(d);
    } catch {
      setAnalytics(null);
    }
  };

  useEffect(() => {
    fetch('/api/employees?page=1&limit=200', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.users) setEmployees(d.users); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchList();
    fetchAnalytics();
  }, [filters.year, filters.week, filters.employeeId, filters.role, filters.team, filters.status]);

  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };

  const trendData = analytics?.trend?.map((t: any) => ({
    name: `W${t.weekNumber}`,
    compliance: t.compliance || 0,
  })) || [];

  const metricsData = analytics?.metrics ? [
    { name: '30 DRAFTS?', value: analytics.metrics.drafts30 || 0 },
    { name: 'MYT ADDED', value: analytics.metrics.mytAdded || 0 },
    { name: 'TOURS IN PIPELINE', value: analytics.metrics.toursPipeline || 0 },
    { name: 'TOURS DONE', value: analytics.metrics.toursDone || 0 },
    { name: 'CALLS DONE', value: analytics.metrics.callsDone || 0 },
    { name: 'CONNECTED', value: analytics.metrics.connected || 0 },
  ] : [];

  return (
    <div className="space-y-4">
      <div style={card} className="p-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">ARENA OS - Weekly Performance Tracker</h1>
        <div className="text-xs" style={{ color: '#6b7280' }}>Weekly submission visibility and review</div>
      </div>

      <div style={card} className="p-5 grid grid-cols-2 md:grid-cols-7 gap-3">
        <div>
          <label className="block text-[11px] mb-1.5" style={{ color: '#6b7280' }}>Year</label>
          <input
            type="number"
            value={filters.year}
            onChange={(e) => setFilters(p => ({ ...p, year: Number(e.target.value) }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }}
          />
        </div>
        <div>
          <label className="block text-[11px] mb-1.5" style={{ color: '#6b7280' }}>Week</label>
          <select
            value={filters.week}
            onChange={(e) => setFilters(p => ({ ...p, week: Number(e.target.value) }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }}
          >
            {Array.from({ length: 44 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>Week {i + 1}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-[11px] mb-1.5" style={{ color: '#6b7280' }}>Employee</label>
          <select
            value={filters.employeeId}
            onChange={(e) => setFilters(p => ({ ...p, employeeId: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }}
          >
            <option value="">All</option>
            {employees.map((e: any) => <option key={e._id} value={e._id}>{e.fullName}</option>)}
          </select>
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
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="reviewed">Reviewed</option>
            <option value="missing">Missing</option>
          </select>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Employees', value: summary.totalEmployees, color: '#111827' },
            { label: 'Submitted', value: summary.submittedWeek, color: '#10b981' },
            { label: 'Missing', value: summary.missingWeek, color: '#ef4444' },
            { label: 'Good Weeks', value: summary.goodWeeks, color: '#f59e0b' },
          ].map((s) => (
            <div key={s.label} style={card} className="p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value || 0}</div>
              <div className="text-[10px]" style={{ color: '#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {analytics?.summary && (
        <div style={card} className="p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Compliance Overview</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}>
              <div className="text-2xl font-bold text-emerald-600">{analytics.summary.complianceWeek}%</div>
              <div className="text-[10px]" style={{ color: '#6b7280' }}>This Week</div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}>
              <div className="text-2xl font-bold text-indigo-600">{analytics.summary.complianceLast4}%</div>
              <div className="text-[10px]" style={{ color: '#6b7280' }}>Last 4 Weeks</div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}>
              <div className="text-2xl font-bold text-orange-500">{analytics.summary.pendingReviews || 0}</div>
              <div className="text-[10px]" style={{ color: '#6b7280' }}>Pending Reviews</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div style={card} className="p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Weekly Submission Trend</h2>
          {trendData.length === 0 ? (
            <div className="text-xs text-gray-500">No trend data yet.</div>
          ) : (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="compliance" stroke="#f97316" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div style={card} className="p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Weekly Metric Totals</h2>
          {metricsData.length === 0 ? (
            <div className="text-xs text-gray-500">No metric data yet.</div>
          ) : (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div style={card} className="p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Daily Tracker Submissions</h2>
        {loading ? (
          <div className="text-xs text-gray-500">Loading submissions...</div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-gray-500">No records found for the selected filters.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.employeeId} className="grid grid-cols-1 md:grid-cols-[2fr,0.7fr,0.9fr,0.9fr,0.9fr,0.9fr,0.9fr,0.9fr,0.8fr,auto] gap-2 items-center p-3 rounded-xl border border-gray-100 bg-gray-50">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{r.employeeName}</div>
                  <div className="text-[10px] text-gray-500">{r.teamName || 'No Team'}</div>
                </div>
                <div className="text-xs text-gray-700">W{filters.week}</div>
                {[
                  { key: 'drafts30', label: '30 DRAFTS?' },
                  { key: 'mytAdded', label: 'MYT ADDED' },
                  { key: 'toursPipeline', label: 'TOURS IN PIPELINE' },
                  { key: 'toursDone', label: 'TOURS DONE' },
                  { key: 'callsDone', label: 'CALLS DONE' },
                  { key: 'connected', label: 'CONNECTED' },
                ].map((k) => (
                  <div key={k.key} className="text-xs text-gray-700">
                    {r.tracker?.[k.key] ?? 0}
                  </div>
                ))}
                <div className="text-xs text-gray-700">
                  {r.tracker?.doubts ? 'Yes' : 'No'}
                </div>
                <div className={`text-xs font-semibold ${
                  r.status === 'reviewed' ? 'text-emerald-600' : r.status === 'submitted' ? 'text-orange-500' : r.status === 'draft' ? 'text-gray-600' : 'text-red-500'
                }`}>{r.status}</div>
                <div className="text-right">
                  <button
                    onClick={() => router.push(`/admin/daily-tracker/${r.employeeId}?year=${filters.year}&week=${filters.week}`)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
                  >
                    {r.status === 'submitted' ? 'Review' : 'View'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div style={card} className="p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Top Consistent Submitters (Last 4 Weeks)</h2>
            {analytics.topSubmitters?.length ? (
              <div className="space-y-2">
                {analytics.topSubmitters.map((t: any) => (
                  <div key={t.employeeId} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <span className="text-gray-900 font-semibold">{t.name}</span>
                    <span className="text-gray-600">{t.submitted} weeks</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No data yet.</div>
            )}
          </div>
          <div style={card} className="p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Repeated Missing Submissions</h2>
            {analytics.repeatMissing?.length ? (
              <div className="space-y-2">
                {analytics.repeatMissing.map((t: any) => (
                  <div key={t.employeeId} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <span className="text-gray-900 font-semibold">{t.name}</span>
                    <span className="text-gray-600">{t.missed} missed</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No repeated misses.</div>
            )}
          </div>
          <div style={card} className="p-5 md:col-span-2">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Good Week Percentage (Top)</h2>
            {analytics.goodWeekRate?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {analytics.goodWeekRate.map((t: any) => (
                  <div key={t.employeeId} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <span className="text-gray-900 font-semibold">{t.name}</span>
                    <span className="text-gray-600">{t.rate}% ({t.goodWeeks}/{t.submittedWeeks})</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No good-week data yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
