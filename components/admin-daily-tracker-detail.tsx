'use client';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentWeekInfo } from '@/lib/week-utils';

export default function AdminWeeklyTrackerDetail({ employeeId }: { employeeId: string }) {
  const now = useMemo(() => getCurrentWeekInfo(), []);
  const [year, setYear] = useState(now.year);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [review, setReview] = useState({ isGoodWeek: false, adminNotes: '', adminImpact: '', adminIssues: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/tracker/weekly?employeeId=${employeeId}&year=${year}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) {
        setRecords(d.records || []);
        if (d.records?.[0]?._id) setActiveId(d.records[0]._id);
      }
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year, employeeId]);

  const active = records.find(r => r._id === activeId) || null;
  const employeeName = active?.employeeName || 'Employee';
  const role = active?.role || '';
  const team = active?.teamName || '';


  const missingWeeks = () => {
    const filled = new Set(records.map(r => r.weekNumber));
    const maxWeek = year === now.year ? now.weekNumber : 44;
    const missing = [];
    for (let w = 1; w <= maxWeek; w += 1) {
      if (!filled.has(w)) missing.push(w);
    }
    return missing;
  };

  const monthlySummary = () => {
    const map: Record<string, { total: number; submitted: number; reviewed: number; good: number }> = {};
    records.forEach(r => {
      const key = String(r.weekStartDate || '').slice(0, 7) || 'Unknown';
      if (!map[key]) map[key] = { total: 0, submitted: 0, reviewed: 0, good: 0 };
      map[key].total += 1;
      if (r.status === 'submitted' || r.status === 'reviewed') map[key].submitted += 1;
      if (r.status === 'reviewed') map[key].reviewed += 1;
      if (r.isGoodWeek) map[key].good += 1;
    });
    return Object.entries(map).map(([month, s]) => ({ month, ...s }));
  };

  const submitReview = async () => {
    if (!active?._id) return;
    setMsg(null);
    try {
      const r = await fetch('/api/tracker/weekly/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackerId: active._id, ...review }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Review failed');
      setMsg({ ok: true, text: 'Review submitted.' });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Review failed' });
    }
  };

  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };

  return (
    <div className="space-y-4">
      <div style={card} className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">ARENA OS - Daily Tracker Detail</h1>
            <div className="text-xs" style={{ color: '#6b7280' }}>
              {employeeName} {role ? `• ${role}` : ''} {team ? `• ${team}` : ''}
            </div>
          </div>
          <div className="w-28">
            <label className="block text-[11px] mb-1.5" style={{ color: '#6b7280' }}>Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
            />
          </div>
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-medium border ${
          msg.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>{msg.text}</div>
      )}

      <div style={card} className="p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Weekly Records</h2>
        {loading ? (
          <div className="text-xs text-gray-500">Loading records...</div>
        ) : records.length === 0 ? (
          <div className="text-xs text-gray-500">No weekly records for {year}.</div>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <button
                key={r._id}
                onClick={() => setActiveId(r._id)}
                className={`w-full text-left p-3 rounded-xl border ${
                  activeId === r._id ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900">Week {r.weekNumber}</div>
                  <span className="text-xs font-semibold" style={{ color: r.status === 'reviewed' ? '#10b981' : r.status === 'submitted' ? '#f59e0b' : '#6b7280' }}>
                    {r.status}
                  </span>
                </div>
                <div className="text-[11px] text-gray-600 mt-1">{r.weekStartDate} - {r.weekEndDate}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {active && (
        <div style={card} className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Week {active.weekNumber} Details</h2>
            {active.isGoodWeek && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-green-50 text-green-600">Good Week ✓</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {[
              { key: 'drafts30', label: '30 DRAFTS?' },
              { key: 'mytAdded', label: 'MYT ADDED' },
              { key: 'toursPipeline', label: 'TOURS IN PIPELINE' },
              { key: 'toursDone', label: 'TOURS DONE' },
              { key: 'callsDone', label: 'CALLS DONE' },
              { key: 'connected', label: 'CONNECTED' },
            ].map((f) => (
              <div key={f.key} className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <div className="text-[10px] text-gray-500">{f.label}</div>
                <div className="text-sm font-semibold text-gray-900">{active?.[f.key] ?? 0}</div>
              </div>
            ))}
            <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 md:col-span-3">
              <div className="text-[10px] text-gray-500">DOUBTS</div>
              <div className="text-sm text-gray-900 mt-1">{active?.doubts || '--'}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
              <div className="text-[10px] text-gray-500">LEADS ADDED TODAY</div>
              <div className="text-lg font-semibold text-gray-900">{active?.manualLeadsToday ?? 0}</div>
            </div>
            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
              <div className="text-[10px] text-gray-500">TOURS SCHEDULED TODAY</div>
              <div className="text-lg font-semibold text-gray-900">{active?.manualToursToday ?? 0}</div>
            </div>
          </div>
          {active.status === 'submitted' && (
            <div className="space-y-3 pt-2">
              <div className="text-sm font-semibold text-gray-900">Admin Review</div>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={review.isGoodWeek}
                  onChange={(e) => setReview(p => ({ ...p, isGoodWeek: e.target.checked }))}
                />
                Mark as Good Week ✓
              </label>
              <textarea
                rows={2}
                placeholder="Admin Notes"
                value={review.adminNotes}
                onChange={(e) => setReview(p => ({ ...p, adminNotes: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
              />
              <textarea
                rows={2}
                placeholder="Impact Assessment"
                value={review.adminImpact}
                onChange={(e) => setReview(p => ({ ...p, adminImpact: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
              />
              <textarea
                rows={2}
                placeholder="Issues Noted"
                value={review.adminIssues}
                onChange={(e) => setReview(p => ({ ...p, adminIssues: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
              />
              <button
                onClick={submitReview}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#f97316' }}
              >
                Submit Review
              </button>
            </div>
          )}

          {active.status === 'reviewed' && (
            <div className="text-xs text-gray-700">
              Reviewed: {active.reviewedAt ? new Date(active.reviewedAt).toLocaleDateString('en-IN') : '--'} | Admin Notes: {active.adminNotes || '—'}
            </div>
          )}
        </div>
      )}

      <div style={card} className="p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Missing Weeks ({year})</h2>
        <div className="text-xs text-gray-700">
          {missingWeeks().length ? missingWeeks().join(', ') : 'No missing weeks.'}
        </div>
      </div>

      <div style={card} className="p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Monthly Summary ({year})</h2>
        {records.length === 0 ? (
          <div className="text-xs text-gray-500">No monthly data yet.</div>
        ) : (
          <div className="space-y-2">
            {monthlySummary().map((m) => (
              <div key={m.month} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <span className="font-semibold text-gray-900">{m.month}</span>
                <span className="text-gray-600">
                  {m.submitted}/{m.total} submitted • {m.reviewed} reviewed • {m.good} good
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
