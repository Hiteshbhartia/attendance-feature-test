'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, AlertTriangle, CheckSquare, HeartPulse, Plus, Search, Calendar as CalendarIcon, Video, RefreshCw, Brain, Sparkles, Target, ArrowRight, Info, ShieldCheck, CheckCircle2, TrendingDown, ChevronRight } from 'lucide-react';
import ScheduleSessionModal from '@/components/coaching/ScheduleSessionModal';
import SessionDetailModal from '@/components/coaching/SessionDetailModal';

const TABS = [
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
];

const HEALTH_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'doing-well': { label: 'Doing Well', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  'needs-attention': { label: 'Needs Attention', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  'immediate-support': { label: 'Immediate Support', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

function initials(name: string) {
  if (!name) return '?';
  try {
    return name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();
  } catch (e) {
    return '?';
  }
}

const AVATAR_COLORS = [
  ['#f97316','#1a0f00'], ['#6366f1','#0d0d24'], ['#10b981','#001a0f'],
  ['#a855f7','#150024'], ['#f59e0b','#1a1300'], ['#ef4444','#1a0000'],
];

function avColor(name: string) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0; 
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}

export default function CoachingDashboard() {
  const [activeTab, setActiveTab] = useState('intelligence');
  const [search, setSearch] = useState('');
  
  const [data, setData] = useState<{ sessions: any[]; metrics: any } | null>(null);
  const [intelData, setIntelData] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [intelLoading, setIntelLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedEmployeeForSession, setSelectedEmployeeForSession] = useState<string | undefined>(undefined);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coaching?tab=${activeTab === 'intelligence' ? 'upcoming' : activeTab}&search=${search}`);
      const d = await res.json();
      if (d.ok) setData({ sessions: d.sessions || [], metrics: d.metrics });
    } catch (err) {
      console.error('Dashboard Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  const fetchIntelligence = useCallback(async (refresh = false) => {
    setIntelLoading(true);
    setErrorMsg(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); 

    try {
      const res = await fetch(`/api/coaching/intelligence${refresh ? '?refresh=true' : ''}`, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      const d = await res.json();
      if (res.ok && d.ok && d.data) {
        setIntelData(d.data);
      } else {
        throw new Error(d.error || 'Intelligence analysis failed');
      }
    } catch (err: any) {
      console.error('Intelligence Fetch Error:', err);
      if (err.name === 'AbortError') {
        setErrorMsg('The analysis is taking longer than expected. Please retry.');
      } else {
        setErrorMsg(err.message || 'System connectivity issue');
      }
    } finally {
      setIntelLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboard();
      if (activeTab === 'intelligence') {
        fetchIntelligence();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [activeTab, search, fetchDashboard, fetchIntelligence]);

  const cardStyle = useMemo(() => ({ 
    background: '#ffffff', 
    border: '1px solid #e5e7eb', 
    borderRadius: 20, 
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)' 
  }), []);

  const renderIntelligence = () => {
    if (intelLoading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {Array(3).fill(0).map((_, i) => (
               <div key={i} className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
             ))}
          </div>
          <div className="h-64 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
        </div>
      );
    }

    if (errorMsg || !intelData) {
      return (
        <div className="text-center py-20 bg-white border border-gray-100 rounded-3xl shadow-sm mx-auto max-w-2xl">
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-orange-400" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">
            {errorMsg?.includes('Unauthorized') ? 'Access Restricted' : 'Intelligence Unavailable'}
          </h2>
          <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
            {errorMsg?.includes('Unauthorized') 
              ? 'You do not have permission to access coaching intelligence.' 
              : 'The operational risk engine is currently being recalibrated. Manual scheduling and historical reviews are still fully operational.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             {!errorMsg?.includes('Unauthorized') && (
               <button onClick={() => fetchIntelligence(true)} className="px-8 py-3 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl">
                 Retry Intelligence Scan
               </button>
             )}
             <button onClick={() => { setSelectedEmployeeForSession(undefined); setIsScheduleModalOpen(true); }} className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all">
               Manual Schedule
             </button>
          </div>
        </div>
      );
    }

    const suggestions = intelData.suggestedSessions || [];
    const needsAtt = intelData.needsAttention || [];
    const highPerf = intelData.highPerformers || [];
    const track = intelData.onTrack || [];

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        
        {/* Real-time Status Badge */}
        <div className="flex items-center justify-between bg-white border border-emerald-100 rounded-2xl px-5 py-3 shadow-sm shadow-emerald-50/50">
          <div className="flex items-center gap-3 text-emerald-700">
            <div className="relative flex">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute opacity-75"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.15em]">Prioritized Operational Intelligence</span>
          </div>
          <button 
            onClick={() => fetchIntelligence(true)} 
            disabled={intelLoading}
            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-50"
            title="Force Refresh Intelligence"
          >
            <RefreshCw className={`w-4 h-4 ${intelLoading ? 'animate-spin' : ''}`} />
          </button>
          {intelData.analysisInfo && (
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
              Scanned {intelData.analysisInfo.employeeCount} Profiles • Sorted by Urgency
            </div>
          )}
        </div>

        <>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-6 h-6 text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900">Priority Intervention Queue</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suggestions.map((session: any, idx: number) => {
              const [bg, fg] = avColor(session.employeeName);
              const isHigh = session.severity === 'high';
              return (
                <div key={`sugg-${session.employeeId}-${idx}`} style={cardStyle} className={`p-6 flex flex-col group relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 border-gray-100 ${isHigh ? 'ring-2 ring-red-500/10' : ''}`}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-sm border border-white" style={{ background: bg, color: fg }}>
                      {initials(session.employeeName)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 line-clamp-1">{session.employeeName}</div>
                      <div className={`text-[10px] uppercase font-black tracking-wider mt-0.5 ${isHigh ? 'text-red-500' : session.severity === 'medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {session.type}
                      </div>
                    </div>
                    {session.riskScore > 0 && (
                      <div className="ml-auto text-right">
                         <div className="text-[10px] font-black text-gray-400 uppercase leading-none">RISK</div>
                         <div className={`text-lg font-black leading-none mt-0.5 ${isHigh ? 'text-red-600' : 'text-gray-900'}`}>{session.riskScore}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-3 mb-6">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contributing Factors</div>
                    <ul className="space-y-2">
                      {(session.reasons || []).map((reason: string, rIdx: number) => (
                        <li key={rIdx} className="flex items-start gap-2 text-[11px] text-gray-600 leading-tight">
                          <TrendingDown className={`w-3 h-3 mt-0.5 shrink-0 ${isHigh ? 'text-red-400' : 'text-orange-400'}`} />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button 
                    onClick={() => { setSelectedEmployeeForSession(session.employeeId); setIsScheduleModalOpen(true); }}
                    className={`w-full py-3 font-black text-[10px] uppercase tracking-[0.1em] rounded-2xl transition-all border flex items-center justify-center gap-2 ${isHigh ? 'bg-red-600 border-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-100' : 'bg-gray-50 border-gray-100 text-gray-900 hover:bg-gray-900 hover:text-white'}`}
                  >
                    Schedule Intervention <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Column 1: Attention (PRIORITIZED) */}
            <div style={cardStyle} className="overflow-hidden flex flex-col bg-slate-50/20">
              <div className="p-5 bg-red-50/40 border-b border-red-100/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <h3 className="text-[10px] font-black text-red-900 uppercase tracking-[0.2em]">Attention Required</h3>
                </div>
                <div className="text-[9px] font-black text-red-500/50 uppercase tracking-tighter">Sorted by Risk</div>
              </div>
              <div className="p-4 flex-1 space-y-3">
                {needsAtt.length > 0 ? needsAtt.map((emp: any) => (
                  <div key={`needs-${emp.employeeId}`} className="p-4 rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md relative overflow-hidden">
                    {emp.riskScore >= 100 && <div className="absolute top-0 right-0 w-1 h-full bg-red-500"></div>}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-gray-900">{emp.employeeName}</div>
                        {emp.manualHealth && emp.manualHealth !== 'doing-well' && (
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${emp.manualHealth === 'immediate-support' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                            {emp.manualHealth.replace('-', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="text-[14px] font-black text-red-600">{emp.riskScore}</div>
                    </div>
                    <div className="space-y-1">
                      {(emp.riskBreakdown || []).slice(0, 2).map((b: any, bi: number) => (
                        <div key={bi} className="flex justify-between text-[9px] text-gray-500 font-medium">
                          <span>{b.factor}</span>
                          <span className="font-bold text-gray-700">{b.impact}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : <div className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">No Priority Alerts</div>}
              </div>
            </div>

            {/* Column 2: High Performers */}
            <div style={cardStyle} className="overflow-hidden flex flex-col bg-slate-50/20">
              <div className="p-5 bg-emerald-50/40 border-b border-emerald-100/50 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <h3 className="text-[10px] font-black text-emerald-900 uppercase tracking-[0.2em]">High Performers</h3>
              </div>
              <div className="p-4 flex-1 space-y-3">
                {highPerf.length > 0 ? highPerf.map((emp: any) => (
                  <div key={`high-${emp.employeeId}`} className="p-4 rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-bold text-gray-900">{emp.employeeName}</div>
                      <div className="text-[14px] font-black text-emerald-600">{emp.performanceScore}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                       {(emp.positiveFlags || []).map((f: string, fi: number) => (
                         <div key={fi} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-bold rounded border border-emerald-100 uppercase tracking-tighter">{f}</div>
                       ))}
                    </div>
                  </div>
                )) : <div className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Awaiting Peak Perf</div>}
              </div>
            </div>

            {/* Column 3: Steady */}
            <div style={cardStyle} className="overflow-hidden flex flex-col bg-slate-50/20">
              <div className="p-5 bg-blue-50/40 border-b border-blue-100/50 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                <h3 className="text-[10px] font-black text-blue-900 uppercase tracking-[0.2em]">Operational Stability</h3>
              </div>
              <div className="p-4 flex-1 space-y-3">
                {track.length > 0 ? track.map((emp: any) => (
                  <div key={`track-${emp.employeeId}`} className="p-4 rounded-2xl border border-gray-100 bg-white shadow-sm flex items-center justify-between transition-all hover:shadow-md">
                    <div className="text-sm font-bold text-gray-900">{emp.employeeName}</div>
                    <div className="px-3 py-1 bg-blue-50 text-blue-700 text-[9px] font-black rounded-lg uppercase tracking-tighter">
                      {emp.stats?.eodConsistency || 0}% EOD
                    </div>
                  </div>
                )) : <div className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Steady Analysis</div>}
              </div>
            </div>
          </div>
        </>
      </div>
    );
  };

  const renderSessionList = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {loading ? (
         Array(6).fill(0).map((_, i) => <div key={i} className="h-44 bg-white rounded-3xl border border-gray-100 animate-pulse"></div>)
      ) : data?.sessions?.length === 0 ? (
        <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-200 border-dashed shadow-sm">
          <CalendarIcon className="w-12 h-12 text-gray-100 mx-auto mb-4" />
          <div className="text-gray-400 font-black text-xs uppercase tracking-widest">No sessions matched</div>
        </div>
      ) : (
        data?.sessions?.map(session => {
          const [bg, fg] = avColor(session.employeeName);
          const dateStr = new Date(session.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
          const hc = HEALTH_CONFIG[session.healthStatus] || HEALTH_CONFIG['doing-well'];

          return (
            <div 
              key={session._id} 
              style={cardStyle} 
              className="p-6 cursor-pointer hover:border-gray-900/10 transition-all group relative overflow-hidden bg-white hover:shadow-2xl"
              onClick={() => setSelectedSessionId(session._id)}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow-sm" style={{ background: bg, color: fg }}>
                    {initials(session.employeeName)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{session.employeeName}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{session.employeeRole || 'Member'}</div>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest" style={{ background: hc.bg, color: hc.color }}>
                  {hc.label}
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-[11px] text-gray-600 font-bold">
                  <CalendarIcon className="w-3.5 h-3.5 text-gray-300" />
                  {dateStr}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-600 font-bold">
                  {session.meetingType === 'in-person' ? <Users className="w-3.5 h-3.5 text-gray-300" /> : <Video className="w-3.5 h-3.5 text-gray-300" />}
                  <span className="capitalize">{session.meetingType.replace('-', ' ')} • {session.duration}m</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-gray-100">
                <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                  {session.actionItems?.length || 0} Actions
                </div>
                <div className="text-[10px] font-black text-orange-500 flex items-center gap-1 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                  VIEW REPORT &rarr;
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">1:1 Sessions</h1>
          <div className="flex items-center gap-2 mt-1">
             <div className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-black uppercase tracking-widest rounded-md">Operational Priority Engine</div>
             <div className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] ml-1">Urgency-Based Management</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { fetchDashboard(); fetchIntelligence(true); }} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-gray-100 text-gray-400 hover:text-orange-500 transition-all shadow-sm hover:shadow-md">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setSelectedEmployeeForSession(undefined); setIsScheduleModalOpen(true); }} className="flex items-center gap-3 px-8 py-3 bg-gray-900 hover:bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl hover:scale-105 active:scale-95">
            <Plus className="w-4 h-4" />
            Schedule Session
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      {data?.metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div style={cardStyle} className="p-5 flex items-center gap-4 bg-white shadow-sm border-gray-100 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 border border-blue-100/50 shadow-inner"><CalendarIcon className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-black text-gray-900 leading-none">{data.metrics.upcoming}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Scheduled</div>
            </div>
          </div>
          <div style={cardStyle} className="p-5 flex items-center gap-4 bg-white shadow-sm border-gray-100 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 border border-orange-100/50 shadow-inner"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-black text-gray-900 leading-none">{data.metrics.needsAttention}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">High Risk</div>
            </div>
          </div>
          <div style={cardStyle} className="p-5 flex items-center gap-4 bg-white shadow-sm border-gray-100 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100/50 shadow-inner"><CheckSquare className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-black text-gray-900 leading-none">{data.metrics.taskCompletionRate}%</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Completion</div>
            </div>
          </div>
          <div style={cardStyle} className="p-5 flex items-center gap-4 bg-white shadow-sm border-gray-100 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100/50 shadow-inner"><HeartPulse className="w-5 h-5" /></div>
            <div className="w-full">
              <div className="flex justify-between items-end mb-1.5">
                <div className="text-2xl font-black text-gray-900 leading-none">{data.metrics.doingWell}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">HEALTH</div>
              </div>
              <div className="flex gap-1 h-1.5 rounded-full overflow-hidden w-full bg-gray-100/50">
                <div style={{ width: `${(data.metrics.doingWell / Math.max(1, data.metrics.doingWell + data.metrics.needsAttentionCount + data.metrics.immediateSupport)) * 100}%`, background: HEALTH_CONFIG['doing-well'].color }}></div>
                <div style={{ width: `${(data.metrics.needsAttentionCount / Math.max(1, data.metrics.doingWell + data.metrics.needsAttentionCount + data.metrics.immediateSupport)) * 100}%`, background: HEALTH_CONFIG['needs-attention'].color }}></div>
                <div style={{ width: `${(data.metrics.immediateSupport / Math.max(1, data.metrics.doingWell + data.metrics.needsAttentionCount + data.metrics.immediateSupport)) * 100}%`, background: HEALTH_CONFIG['immediate-support'].color }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 p-1 bg-gray-100/40 backdrop-blur-md rounded-2xl w-fit border border-gray-100 shadow-inner">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-md border border-gray-50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'intelligence' ? renderIntelligence() : renderSessionList()}

      <ScheduleSessionModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedEmployeeForSession(undefined);
        }} 
        initialEmployeeId={selectedEmployeeForSession}
        onSuccess={(sid) => { 
          setIsScheduleModalOpen(false); 
          setSelectedEmployeeForSession(undefined);
          setSelectedSessionId(sid);
          fetchDashboard(); 
          fetchIntelligence(true); 
        }} 
      />

      {selectedSessionId && (
        <SessionDetailModal
          sessionId={selectedSessionId}
          isOpen={!!selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
          onUpdate={fetchDashboard}
        />
      )}
    </div>
  );
}
