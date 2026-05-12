'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function AdminTrackerDetail({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  if (!employeeId) {
    return <div className="text-xs text-gray-500">No employee selected.</div>;
  }
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ start: '', end: '' });

  const defaultCheckins = [
    { key: 'G1MYT', label: 'G1MYT', range: '10:30 AM - 12:00 PM', status: 'idle', targetCount: 0, progressNote: '', startedAt: '', completedAt: '', mytAdded: 0, toursInPipeline: 0, toursDone: 0, callsDone: 0, connected: 0, mytWhoWillPayToday: 0, tenantsPaid: 0, doubts: '', problems: '' },
    { key: 'G2MYT', label: 'G2MYT', range: '12:00 PM - 2:15 PM', status: 'idle', targetCount: 0, progressNote: '', startedAt: '', completedAt: '', mytAdded: 0, toursInPipeline: 0, toursDone: 0, callsDone: 0, connected: 0, mytWhoWillPayToday: 0, tenantsPaid: 0, doubts: '', problems: '' },
    { key: 'G3MYT', label: 'G3MYT', range: '2:30 PM - 4:00 PM', status: 'idle', targetCount: 0, progressNote: '', startedAt: '', completedAt: '', mytAdded: 0, toursInPipeline: 0, toursDone: 0, callsDone: 0, connected: 0, mytWhoWillPayToday: 0, tenantsPaid: 0, doubts: '', problems: '' },
    { key: 'G4MYT', label: 'G4MYT', range: '4:00 PM - 5:35 PM', status: 'idle', targetCount: 0, progressNote: '', startedAt: '', completedAt: '', mytAdded: 0, toursInPipeline: 0, toursDone: 0, callsDone: 0, connected: 0, mytWhoWillPayToday: 0, tenantsPaid: 0, doubts: '', problems: '' },
  ];

  const buildDateRange = (start: string, end: string) => {
    if (!start || !end) return [];
    const out: string[] = [];
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      out.push(iso);
    }
    return out;
  };

  const fetchDetail = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const r = await fetch(`/api/tracker/employee/${employeeId}?${params.toString()}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) {
        setData(d);
        setRange({ start: d.range?.start || '', end: d.range?.end || '' });
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [employeeId]);

  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };

  if (loading) {
    return <div className="p-10 text-center text-xs text-gray-500">Loading tracker detail...</div>;
  }

  if (!data) {
    return (
      <div className="p-10 text-center space-y-4">
        <div className="text-xs text-gray-500">Unable to load tracker detail.</div>
        <button onClick={() => router.back()} className="text-sm font-semibold text-orange-600">Go Back</button>
      </div>
    );
  }

  const displayRecords = (() => {
    if (Array.isArray(data.records) && data.records.length > 0) return data.records;
    const dates = buildDateRange(range.start, range.end);
    return dates.map((date) => ({
      _id: `empty-${date}`,
      date,
      initial: '',
      onIt: '',
      impact: '',
      notes: '',
      issues: '',
      isSubmitted: false,
      isEdited: false,
      dailyCheckins: defaultCheckins,
    }));
  })();

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors border border-gray-200 bg-white shadow-sm"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div style={card} className="flex-1 p-5">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">ARENA OS - Daily Updates Detail</h1>
          <div className="text-xs" style={{ color: '#6b7280' }}>
            {data.employee?.fullName} • {data.employee?.role}
          </div>
        </div>
      </div>

      <div style={card} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Summary (Last 90 Days)</h2>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={range.start} 
              onChange={(e) => setRange(p => ({ ...p, start: e.target.value }))} 
              className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs focus:ring-2 focus:ring-orange-500 outline-none" 
            />
            <span className="text-gray-400 text-xs">-</span>
            <input 
              type="date" 
              value={range.end} 
              onChange={(e) => setRange(p => ({ ...p, end: e.target.value }))} 
              className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs focus:ring-2 focus:ring-orange-500 outline-none" 
            />
            <button 
              onClick={() => fetchDetail(range.start, range.end)} 
              className="px-4 py-1.5 rounded-xl text-white text-xs font-bold transition-all hover:opacity-90 active:scale-95" 
              style={{ background: '#f97316' }}
            >
              Apply Filter
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {[
            { label: 'Total Days', value: data.summary.totalDays, color: '#111827' },
            { label: 'Submitted', value: data.summary.submittedDays, color: '#10b981' },
            { label: 'Edited', value: data.summary.editedDays, color: '#8b5cf6' },
            { label: 'Missed', value: data.summary.missedDays, color: '#ef4444' },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50">
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value || 0}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card} className="p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Daily Records</h2>
        {displayRecords?.length ? (
          <div className="space-y-4">
            {displayRecords.map((r: any) => (
              <div key={r._id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 group hover:bg-white transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-gray-900 text-sm">{r.date}</div>
                    <div className="text-[10px] text-gray-400 font-medium">#{r._id.toString().slice(-6)}</div>
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${r.isSubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                    {r.isEdited ? 'Edited' : r.isSubmitted ? 'Submitted' : 'Pending'}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                  {[
                    { label: 'INITIAL', value: r.initial },
                    { label: 'ON IT', value: r.onIt },
                    { label: 'IMPACT', value: r.impact },
                    { label: 'ISSUES', value: r.issues },
                    { label: 'NOTES', value: r.notes },
                  ].map((field) => (
                    <div key={field.label} className="bg-white p-2.5 rounded-xl border border-gray-50">
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">{field.label}</div>
                      <div className="text-[11px] text-gray-700 line-clamp-3 leading-relaxed">{field.value || '—'}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white/50 rounded-xl p-3 border border-gray-50">
                  <div className="text-[10px] font-bold text-gray-500 mb-2 px-1">CHECK-IN SLOTS</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {(Array.isArray(r.dailyCheckins) ? r.dailyCheckins : defaultCheckins).map((c: any) => (
                      <div key={c.key} className="p-2.5 rounded-xl border border-gray-100 bg-white">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-[11px] font-bold text-gray-900">{c.label}</div>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'completed' ? 'bg-emerald-500' : c.status === 'started' ? 'bg-orange-400' : 'bg-gray-200'}`} />
                        </div>
                        <div className="text-[9px] text-gray-400 font-medium mb-2">{c.range}</div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-600 font-bold">{c.targetCount} leads</span>
                            <span className="text-[9px] font-bold text-emerald-600 capitalize">{c.status}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 text-[9px] text-gray-500 font-medium">
                            <div>Added: <span className="text-gray-900 font-bold">{c.mytAdded || 0}</span></div>
                            <div>Pipeline: <span className="text-gray-900 font-bold">{c.toursInPipeline || 0}</span></div>
                            <div>Tours: <span className="text-gray-900 font-bold">{c.toursDone || 0}</span></div>
                            <div>Calls: <span className="text-gray-900 font-bold">{c.callsDone || 0}</span></div>
                            <div>Conn: <span className="text-gray-900 font-bold">{c.connected || 0}</span></div>
                            <div>Pay: <span className="text-gray-900 font-bold">{c.mytWhoWillPayToday || 0}</span></div>
                            <div className="col-span-2">Paid: <span className="text-gray-900 font-bold">{c.tenantsPaid || 0}</span></div>
                          </div>
                          {c.progressNote && (
                            <div className="text-[9px] text-gray-500 italic border-t border-gray-50 pt-1 mt-1">"{c.progressNote}"</div>
                          )}
                          {c.doubts && (
                            <div className="text-[9px] text-red-500 font-medium pt-1">D: {c.doubts}</div>
                          )}
                          {c.problems && (
                            <div className="text-[9px] text-orange-600 font-medium pt-1">P: {c.problems}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 p-10 text-center">No tracker records in this range.</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div style={card} className="p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Weekly View</h2>
          {Object.keys(data.weekly || {}).length === 0 ? (
            <div className="text-xs text-gray-500 p-4">No weekly data available.</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.weekly).sort().reverse().map(([week, items]: any) => (
                <div key={week} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex items-center justify-between group hover:bg-white transition-all">
                  <div className="font-bold text-gray-900 text-xs">{week}</div>
                  <div className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                    {items.length} submission(s)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={card} className="p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Monthly View</h2>
          {Object.keys(data.monthly || {}).length === 0 ? (
            <div className="text-xs text-gray-500 p-4">No monthly data available.</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.monthly).sort().reverse().map(([month, items]: any) => (
                <div key={month} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex items-center justify-between group hover:bg-white transition-all">
                  <div className="font-bold text-gray-900 text-xs">{month}</div>
                  <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    {items.length} submission(s)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={card} className="p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Missed Days</h2>
        {data.missedDates?.length ? (
          <div className="flex flex-wrap gap-2">
            {data.missedDates.map((d: string) => (
              <span key={d} className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-100">
                {d}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 p-4">No missed days in this range.</div>
        )}
      </div>
    </div>
  );
}
