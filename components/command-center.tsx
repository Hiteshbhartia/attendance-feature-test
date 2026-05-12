'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, WifiOff, BarChart3 } from 'lucide-react';

interface CCData {
  summary: {
    total: number; present: number; absent: number;
    late: number; early: number; onTime: number;
    onBreak: number; inField: number; activeNow: number;
  };
  healthScore: number;
  kpis: { attendance: number; onTimeRate: number; taskCompletion: number; breakDiscipline: number; };
  trackerCompliance?: { daily: number; weekly: number; monthly: number; submittedToday: number; missingToday: number; editedToday: number; };
  teamPulse: { employeeId: string; employeeName: string; team: string; workMode: string; dayStatus: string; checkInTime: string | null; }[];
  taskSummary: { blocked: number; overdue: number; total: number; completed: number; };
  pendingApprovals: number;
  needAction: { type: string; count: number; label: string; }[];
  compare?: { yesterdayPresent: number; presentDelta: number };
  date: string;
}

interface CrmDaily {
  date: string;
  leadsToday: number;
  toursScheduledToday: number;
  perEmployee: { memberId: string; name: string; zoneName?: string; leadsToday: number; toursToday: number }[];
}

const EMPTY_DATA: CCData = {
  summary: { total: 0, present: 0, absent: 0, late: 0, early: 0, onTime: 0, onBreak: 0, inField: 0, activeNow: 0 },
  healthScore: 0,
  kpis: { attendance: 0, onTimeRate: 0, taskCompletion: 0, breakDiscipline: 0 },
  teamPulse: [],
  taskSummary: { blocked: 0, overdue: 0, total: 0, completed: 0 },
  pendingApprovals: 0,
  needAction: [],
  date: new Date().toISOString().slice(0, 10),
};

const MODE_DOT: Record<string, string> = {
  Present: '#10b981', Break: '#f59e0b', Field: '#6366f1', WFH: '#a855f7', Absent: '#374151',
};
const MODE_LABEL_COLOR: Record<string, string> = {
  Present: '#10b981', Break: '#f59e0b', Field: '#6366f1', WFH: '#a855f7', Absent: '#9ca3af',
};

const AVATAR_COLORS = [
  ['#f97316','#1a0f00'], ['#6366f1','#0d0d24'], ['#10b981','#001a0f'],
  ['#a855f7','#150024'], ['#f59e0b','#1a1300'], ['#ef4444','#1a0000'],
];
function avColor(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function initials(name: string) {
  return (name || '').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function KPIRing({ value, label, color }: { value: number; label: string; color: string }) {
  const safeVal = Math.max(0, Math.min(100, value ?? 0));
  const r = 30; const circ = 2 * Math.PI * r;
  const dash = (safeVal / 100) * circ;
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 80 }}>
      <div className="relative flex items-center justify-center" style={{ width: 76, height: 76 }}>
        <svg width="76" height="76" style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
          <circle cx="38" cy="38" r={r} fill="none" stroke="#f3f4f6" strokeWidth="6"/>
          <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}/>
        </svg>
        <div className="text-center z-10">
          <div className="text-base font-bold text-gray-900">{safeVal}%</div>
        </div>
      </div>
      <div className="text-[10px] text-center mt-1.5 leading-tight" style={{ color: '#6b7280' }}>{label}</div>
    </div>
  );
}

// Skeleton loading card
function SkeletonCard({ h = 'h-28' }: { h?: string }) {
  return <div className={`${h} rounded-2xl bg-gray-100 animate-pulse`} />;
}

// Degraded banner shown when data is partial
function DegradedBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50 mb-4">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span className="text-xs text-amber-800">
          {error.includes('Unauthorized') 
            ? 'Some widgets are restricted for your role.' 
            : 'Intelligence insights temporarily unavailable. Showing last known data.'}
        </span>
      </div>
      <button onClick={onRetry} className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 ml-4 flex-shrink-0">
        <RefreshCw className="w-3 h-3" /> Retry
      </button>
    </div>
  );
}

export default function CommandCenter() {
  const router = useRouter();
  const [data, setData] = useState<CCData | null>(null);
  const [crmDaily, setCrmDaily] = useState<CrmDaily | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [time, setTime] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(prev => prev); // Keep existing data during refresh
    try {
      const r = await fetch('/api/command-center', { cache: 'no-store' });
      const cc = await r.json();

      if (process.env.NODE_ENV === 'development') {
        console.log('[CommandCenter] API response:', cc);
      }

      if (cc?.ok && cc.summary) {
        setData(cc as CCData);
        setError(null);
        setDegraded(false);
      } else if (cc?.fallbackData) {
        // API returned fallbackData — show degraded mode
        setData({ ...EMPTY_DATA, ...cc.fallbackData });
        setError(cc.error || 'Partial data available');
        setDegraded(true);
      } else {
        // Complete failure
        console.error('[CommandCenter] API load failed:', cc?.error);
        setError(cc?.error || 'Failed to load dashboard data');
        setDegraded(true);
        if (!data) setData(EMPTY_DATA); // Show empty state instead of null
      }
    } catch (err) {
      console.error('[CommandCenter] Network error:', err);
      setError('Network error — check your connection');
      setDegraded(true);
      if (!data) setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
    
    // CRM loads independently — failure does NOT affect main dashboard
    fetch('/api/integrations/crm/daily', { cache: 'no-store' })
      .then(r => r.json())
      .then(crm => { if (crm && !crm.error) setCrmDaily(crm); else setCrmDaily(null); })
      .catch(() => setCrmDaily(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }));
    tick();
    const clock = setInterval(tick, 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchData]);

  const scoreColor = (s: number) => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#ef4444';
  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };

  // Loading skeleton
  if (loading && !data) return (
    <div className="space-y-4">
      <SkeletonCard h="h-44" />
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => <SkeletonCard key={i} h="h-28" />)}
      </div>
      <SkeletonCard h="h-48" />
      <SkeletonCard h="h-64" />
    </div>
  );

  // Complete failure with no data at all (should be very rare now)
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <BarChart3 className="w-8 h-8 text-gray-400" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Dashboard Unavailable</h2>
        <p className="text-sm text-gray-500 max-w-sm">{error || 'Unable to load workforce data. Please try again.'}</p>
      </div>
      <button onClick={fetchData}
        className="px-6 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-2xl hover:bg-black transition-all flex items-center gap-2">
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    </div>
  );

  // Safe destructuring with null-safe fallbacks
  const summary      = data.summary      ?? EMPTY_DATA.summary;
  const healthScore  = data.healthScore  ?? 0;
  const kpis         = data.kpis         ?? EMPTY_DATA.kpis;
  const teamPulse    = data.teamPulse    ?? [];
  const taskSummary  = data.taskSummary  ?? EMPTY_DATA.taskSummary;
  const pendingApprovals = data.pendingApprovals ?? 0;
  const needAction   = data.needAction   ?? [];

  return (
    <div className="space-y-4">

      {/* Degraded mode banner */}
      {degraded && error && (
        <DegradedBanner error={error} onRetry={fetchData} />
      )}

      {/* Header Card */}
      <div style={card} className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400"/>
              <span className="text-xs font-semibold" style={{ color: '#10b981' }}>
                {summary.activeNow ?? 0} of {summary.total ?? 0} Active Today
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ARENA OS - Workforce Overview</h1>
            <div className="text-xs mt-1" style={{ color: '#6b7280' }}>
              {time} - Bangalore
            </div>
            {needAction.length > 0 && (
              <div className="mt-2 text-xs" style={{ color: '#6b7280' }}>
                {needAction.length} item{needAction.length > 1 ? 's' : ''} need attention — {pendingApprovals} approvals pending
              </div>
            )}
            {typeof data.compare?.presentDelta === 'number' && (
              <div className="mt-1 text-xs" style={{ color: data.compare.presentDelta < 0 ? '#ef4444' : '#10b981' }}>
                Attendance vs yesterday: {data.compare.presentDelta > 0 ? '+' : ''}{data.compare.presentDelta}
              </div>
            )}
          </div>

          {/* Health Score */}
          <div className="flex items-center gap-3">
            <button onClick={fetchData}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:bg-gray-100"
              style={{ color: '#6b7280' }}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="flex flex-col items-end">
              <div className="text-[10px] mb-1" style={{ color: '#6b7280' }}>COMPANY HEALTH</div>
              <div className="flex items-center gap-2">
                <div className="text-right text-[10px] space-y-0.5" style={{ color: '#6b7280' }}>
                  <div>Attendance <span className="text-gray-900 font-semibold">{kpis.attendance ?? 0}%</span></div>
                  <div>Execution <span className="text-gray-900 font-semibold">{kpis.taskCompletion ?? 0}%</span></div>
                  <div>On Time <span className="text-gray-900 font-semibold">{kpis.onTimeRate ?? 0}%</span></div>
                </div>
                <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
                  <svg width="64" height="64" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#f3f4f6" strokeWidth="6"/>
                    <circle cx="32" cy="32" r="26" fill="none" stroke={scoreColor(healthScore)} strokeWidth="6"
                      strokeDasharray={`${(healthScore/100)*2*Math.PI*26} ${2*Math.PI*26}`} strokeLinecap="round"/>
                  </svg>
                  <div className="z-10 text-center">
                    <div className="text-lg font-bold text-gray-900 leading-none">{healthScore}</div>
                    <div className="text-[8px]" style={{ color: '#6b7280' }}>SCORE</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Active Now */}
        <div style={{ ...card, cursor: 'pointer' }} className="p-4 hover:border-emerald-500/30 transition-all"
          onClick={() => router.push('/live-attendance')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold tracking-wide" style={{ color: '#6b7280' }}>ACTIVE NOW</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400"/>
          </div>
          <div className="text-4xl font-bold" style={{ color: '#10b981' }}>{summary.activeNow ?? 0}</div>
          <div className="text-[10px] mt-1.5 space-y-0.5" style={{ color: '#6b7280' }}>
            {(summary.onBreak ?? 0) > 0 && <div>{summary.onBreak} on break</div>}
            {(summary.inField ?? 0) > 0 && <div>{summary.inField} in field</div>}
            {(summary.onBreak ?? 0) === 0 && (summary.inField ?? 0) === 0 && <div>All in office</div>}
          </div>
        </div>

        {/* Need Action */}
        <div style={{ ...card, cursor: 'pointer' }} className="p-4 hover:border-amber-500/30 transition-all"
          onClick={() => router.push('/task-board')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold tracking-wide" style={{ color: '#6b7280' }}>NEED ACTION</span>
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
          </div>
          <div className="text-4xl font-bold" style={{ color: '#f59e0b' }}>{needAction.length}</div>
          <div className="text-[10px] mt-1.5" style={{ color: '#6b7280' }}>
            {needAction[0]?.label || 'All clear'}
          </div>
        </div>

        {/* Approvals */}
        <div style={{ ...card, cursor: 'pointer' }} className="p-4 hover:border-orange-500/30 transition-all"
          onClick={() => router.push('/approvals')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold tracking-wide" style={{ color: '#6b7280' }}>APPROVALS</span>
            {pendingApprovals > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#f97316', color: '#fff' }}>{pendingApprovals}</span>
            )}
          </div>
          <div className="text-4xl font-bold" style={{ color: '#f97316' }}>{pendingApprovals}</div>
          <div className="text-[10px] mt-1.5" style={{ color: '#6b7280' }}>Break &amp; attendance</div>
        </div>
      </div>

      {/* KPIs This Week */}
      <div style={card} className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-gray-900">KPIs - This Week</h2>
          <span className="text-[10px]" style={{ color: '#6b7280' }}>Live</span>
        </div>
        <div className="grid grid-cols-4 gap-2 justify-items-center">
          <KPIRing value={kpis.attendance ?? 0}      label="Attendance"       color="#10b981" />
          <KPIRing value={kpis.taskCompletion ?? 0}  label="Task Completion"  color="#6366f1" />
          <KPIRing value={kpis.onTimeRate ?? 0}      label="On Time Rate"     color="#f59e0b" />
          <KPIRing value={kpis.breakDiscipline ?? 0} label="Break Discipline" color="#ef4444" />
        </div>
      </div>

      {/* CRM Daily KPIs */}
      {crmDaily && (
        <div style={card} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">CRM - Daily Activity</h2>
            <span className="text-[10px]" style={{ color: '#6b7280' }}>Live</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-4 rounded-2xl border" style={{ borderColor: '#f3f4f6', background: '#fff' }}>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: '#6b7280' }}>Leads Added Today</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{crmDaily.leadsToday ?? 0}</div>
            </div>
            <div className="p-4 rounded-2xl border" style={{ borderColor: '#f3f4f6', background: '#fff' }}>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: '#6b7280' }}>Tours Scheduled Today</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{crmDaily.toursScheduledToday ?? 0}</div>
            </div>
          </div>
          {(crmDaily.perEmployee?.length ?? 0) > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {crmDaily.perEmployee.map((row) => (
                <div key={row.memberId} className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 bg-gray-50">
                  <div>
                    <div className="text-xs font-semibold text-gray-900">{row.name}</div>
                    <div className="text-[10px]" style={{ color: '#6b7280' }}>{row.zoneName || 'No Zone'}</div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-gray-700">
                    <span>{row.leadsToday ?? 0} leads</span>
                    <span>{row.toursToday ?? 0} tours</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500">No activity recorded today.</div>
          )}
        </div>
      )}

      {/* Tracker Compliance */}
      {data.trackerCompliance && (
        <div style={card} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Daily Updates Compliance</h2>
            <span className="text-[10px]" style={{ color: '#6b7280' }}>Live</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}>
              <div className="text-2xl font-bold text-emerald-600">{data.trackerCompliance.daily ?? 0}%</div>
              <div className="text-[10px]" style={{ color: '#6b7280' }}>Daily</div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}>
              <div className="text-2xl font-bold text-indigo-600">{data.trackerCompliance.weekly ?? 0}%</div>
              <div className="text-[10px]" style={{ color: '#6b7280' }}>Weekly</div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}>
              <div className="text-2xl font-bold text-orange-500">{data.trackerCompliance.monthly ?? 0}%</div>
              <div className="text-[10px]" style={{ color: '#6b7280' }}>Monthly</div>
            </div>
          </div>
          <div className="mt-3 text-[10px]" style={{ color: '#6b7280' }}>
            {data.trackerCompliance.submittedToday ?? 0} submitted, {data.trackerCompliance.missingToday ?? 0} missing, {data.trackerCompliance.editedToday ?? 0} edited
          </div>
        </div>
      )}

      {/* Live Team Pulse */}
      <div style={card} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Live</h2>
          <div className="flex items-center gap-3 text-[10px]" style={{ color: '#6b7280' }}>
            {(['Present','Break','Field','WFH','Absent'] as const).map(m => (
              <span key={m} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: MODE_DOT[m] }}/>{m}
              </span>
            ))}
          </div>
        </div>

        {teamPulse.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No employee data available.</div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto no-scrollbar">
            {teamPulse.map(emp => {
              const [bg, fg] = avColor(emp.employeeName ?? '');
              return (
                <div key={emp.employeeId}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push('/live-attendance')}>
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={{ background: bg, color: fg }}>
                        {initials(emp.employeeName ?? '')}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                        style={{ background: MODE_DOT[emp.workMode] ?? '#374151', borderColor: '#ffffff' }}/>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 leading-tight">
                        {(emp.employeeName ?? '').split(' ').map((n, i) => i === 0 ? n : n[0] + '.').join(' ')}
                      </div>
                      <div className="text-[10px]" style={{ color: '#6b7280' }}>{emp.team ?? 'No Zone'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {emp.checkInTime && (
                      <span className="text-[10px]" style={{ color: '#6b7280' }}>{emp.checkInTime}</span>
                    )}
                    <span className="text-xs font-semibold" style={{ color: MODE_LABEL_COLOR[emp.workMode] ?? '#9ca3af' }}>
                      {emp.workMode}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Need Action List */}
      {needAction.length > 0 && (
        <div style={{ ...card, borderColor: 'rgba(245,158,11,0.2)' }} className="p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }}/>
            Needs Your Attention
          </h2>
          <div className="space-y-2">
            {needAction.map((item, i) => (
              <div key={`${item.type}-${i}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-50 transition-all"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}
                onClick={() => router.push(item.type === 'blocked_tasks' || item.type === 'overdue' ? '/task-board' : '/live-attendance')}>
                <span className="text-sm" style={{ color: '#374151' }}>{item.label}</span>
                <span className="text-xs font-semibold" style={{ color: '#f97316' }}>View →</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
