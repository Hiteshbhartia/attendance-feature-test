'use client';
import { useState, useEffect, useMemo } from 'react';
import { 
  Flame, Shield, Zap, Activity, Plus, Minus, 
  ClipboardList, Lock, ShieldOff, CheckCircle2, 
  MessageSquare, Clock, AlertCircle, ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ArenaConsoleProps {
  userId: string;
  userName: string;
  /** The KPI team slug (e.g. 'recruiter', 'sde', 'hr') — NOT a hierarchy role */
  kpiTeam: string;
  isMonitorMode?: boolean;
}

export default function ArenaConsole({ userId, userName, kpiTeam, isMonitorMode = false }: ArenaConsoleProps) {
  const [state, setState] = useState<any>(null);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [comms, setComms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisionInput, setDecisionInput] = useState('');
  const [eodData, setEodData] = useState<{ goalAchieved: string, whatWasDone: string, liveLinks: { label: string, url: string }[] }>({
    goalAchieved: '',
    whatWasDone: '',
    liveLinks: []
  });
  const [linkDraft, setLinkDraft] = useState<{ label: string, url: string, index?: number } | null>(null);
  const [teamData, setTeamData] = useState<any>(null);
  const [isSubmittingEOD, setIsSubmittingEOD] = useState(false);

  const date = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let ignore = false;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/arena/state?userId=${userId}&date=${date}`).then(r => r.json());
        if (ignore) return;
        if (res.ok) {
          setState(res.state);
          setDefinitions(res.definitions.kpis);
          setSprints(res.definitions.sprints);
          setComms(res.definitions.comms || []);
          setTeamData(res.teamData);
          if (res.state?.eodReport && !eodData.whatWasDone) {
            setEodData({
              goalAchieved: res.state.eodReport.goalAchieved || '',
              whatWasDone: res.state.eodReport.whatWasDone || res.state.eodReport.summary || '',
              liveLinks: res.state.eodReport.liveLinks || []
            });
          }
        }
      } catch (err) {
        console.error("Error fetching arena data:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [userId, kpiTeam, date]);

  const handleUpdateKPI = async (kpiName: string, value: number, isDone: boolean) => {
    if (isMonitorMode) return;
    try {
      const res = await fetch('/api/arena/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, kpis: { [kpiName]: { value, isDone } } })
      });
      const d = await res.json();
      if (d.ok) setState(d.state);
    } catch (err) {}
  };

  const handleToggleSprint = async (index: number, isDone: boolean) => {
    if (isMonitorMode) return;
    try {
      const res = await fetch('/api/arena/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, sprints: { [index]: { isDone } } })
      });
      const d = await res.json();
      if (d.ok) setState(d.state);
    } catch (err) {}
  };

  const handleToggleComm = async (index: number, status: 'SENT' | 'MISSED') => {
    if (isMonitorMode) return;
    try {
      const res = await fetch('/api/arena/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, comms: { [index]: { status } } })
      });
      const d = await res.json();
      if (d.ok) setState(d.state);
    } catch (err) {}
  };

  const handleAddDecision = async () => {
    if (isMonitorMode || !decisionInput.trim()) return;
    try {
      const res = await fetch('/api/arena/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, decision: decisionInput })
      });
      const d = await res.json();
      if (d.ok) {
        setState(d.state);
        setDecisionInput('');
      }
    } catch (err) {}
  };

  const handleToggleShield = async () => {
    if (isMonitorMode) return;
    try {
      const res = await fetch('/api/arena/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, shieldMode: !state?.shieldMode })
      });
      const d = await res.json();
      if (d.ok) setState(d.state);
    } catch (err) {}
  };

  const handleSubmitEOD = async () => {
    if (isMonitorMode || !eodData.goalAchieved || !eodData.whatWasDone.trim() || isSubmittingEOD) {
      if (!eodData.goalAchieved) alert('Please select if your goal was achieved.');
      else if (!eodData.whatWasDone.trim()) alert('Please explain what was done. This field is mandatory.');
      return;
    }

    // Filter valid links just to be safe
    const validLinks = eodData.liveLinks.filter(l => l.label.trim() && l.url.trim() && /^https?:\/\/.+/.test(l.url.trim()));
    
    setIsSubmittingEOD(true);
    try {
      const res = await fetch('/api/arena/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, eodReport: { ...eodData, liveLinks: validLinks } })
      });
      const d = await res.json();
      if (d.ok) {
        setState(d.state);
        alert("EOD Report Submitted Successfully");
      }
    } catch (err) {
      console.error("EOD Submission Error:", err);
    } finally {
      setIsSubmittingEOD(false);
    }
  };

  const handleSaveLinkDraft = () => {
    if (!linkDraft) return;
    if (!linkDraft.label.trim()) return alert("Link Label is required.");
    if (!linkDraft.url.trim() || !/^https?:\/\/.+/.test(linkDraft.url.trim())) {
      return alert("Valid URL is required (must start with http:// or https://).");
    }

    const newLinks = [...eodData.liveLinks];
    if (linkDraft.index !== undefined) {
      newLinks[linkDraft.index] = { label: linkDraft.label.trim(), url: linkDraft.url.trim() };
    } else {
      newLinks.push({ label: linkDraft.label.trim(), url: linkDraft.url.trim() });
    }
    setEodData({ ...eodData, liveLinks: newLinks });
    setLinkDraft(null);
  };

  const handleRemoveLiveLink = (index: number) => {
    const newLinks = [...eodData.liveLinks];
    newLinks.splice(index, 1);
    setEodData({ ...eodData, liveLinks: newLinks });
  };

  const dayScore = useMemo(() => {
    if (!state || definitions.length === 0) return 0;
    const doneCount = definitions.filter(d => {
      const kpi = state.kpis?.[d.kpiName] || state.kpis?.get?.(d.kpiName);
      return kpi?.isDone;
    }).length;
    return Math.round((doneCount / definitions.length) * 100);
  }, [state, definitions]);

  if (loading) return <div className="p-8 text-center animate-pulse">Loading Arena...</div>;

  const cardStyle = { 
    background: 'rgba(255, 255, 255, 0.8)', 
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(229, 231, 235, 0.5)',
    borderRadius: '24px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">

      {/* Header section */}
      <section style={cardStyle} className="p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full -mr-32 -mt-32 transition-all group-hover:bg-orange-500/10" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-8 w-8 text-orange-500" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-orange-500">
                  {(teamData?.teamName || kpiTeam).toUpperCase()} · ARENA TEAM
                </div>
                <h1 className="text-4xl font-black tracking-tight text-gray-900">{userName}</h1>
              </div>
            </div>
            <p className="text-gray-500 font-medium max-w-xl">
              Precision execution of the {teamData?.teamName || kpiTeam} team KPIs. Today's mission is to hit the gold standard targets.
            </p>
          </div>

          <div className="flex flex-col items-center bg-gray-50/50 p-6 rounded-3xl border border-gray-100 min-w-[200px]">
             <div className="relative h-28 w-28 flex items-center justify-center">
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle className="text-gray-200" strokeWidth="8" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50" />
                  <circle 
                    className="text-orange-500 transition-all duration-1000 ease-in-out" 
                    strokeWidth="8" 
                    strokeDasharray={264} 
                    strokeDashoffset={264 - (264 * dayScore) / 100} 
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                    r="42" 
                    cx="50" 
                    cy="50" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-gray-900">{dayScore}%</span>
                </div>
             </div>
             <div className="mt-4 text-center">
                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Day Score</div>
                <Badge className={`mt-1 font-black ${dayScore === 100 ? 'bg-green-500' : 'bg-orange-500'}`}>
                  {dayScore === 100 ? 'DOMINATING' : 'IN PROGRESS'}
                </Badge>
             </div>
          </div>
        </div>

        <button 
          onClick={handleToggleShield}
          disabled={isMonitorMode}
          className={`mt-8 flex items-center gap-3 px-6 py-3 rounded-2xl border text-xs font-mono font-black uppercase tracking-[0.1em] transition-all ${
            state?.shieldMode 
              ? "bg-orange-500/10 border-orange-500/30 text-orange-600 shadow-lg shadow-orange-500/10" 
              : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
          } ${isMonitorMode ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {state?.shieldMode ? <Lock className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
          <span>{state?.shieldMode ? "Shield Mode Active" : "Shield Mode Offline"}</span>
          <div className={`h-1.5 w-1.5 rounded-full ${state?.shieldMode ? 'bg-orange-500 animate-pulse' : 'bg-gray-300'}`} />
          <span className="opacity-60">{state?.shieldMode ? "Distractions Blocked" : "Comms Open"}</span>
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: KPIs & Sprints */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* KPIs Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-orange-500 fill-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-gray-900">MISSION CRITICAL KPIs</h3>
                <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">Hit these targets to win the day.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {definitions.map((def) => {
                const kpi = state?.kpis?.[def.kpiName] || state?.kpis?.get?.(def.kpiName) || { value: 0, isDone: false };
                const isTargetHit = def.type === 'BOOLEAN' ? kpi.isDone === def.target : kpi.value >= def.target;
                const isBoolean = def.type === 'BOOLEAN';
                
                return (
                  <div key={def._id} style={cardStyle} className={`p-5 transition-all ${kpi.isDone ? 'bg-green-50/50 border-green-200' : ''}`}>
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div>
                        <h4 className="font-black text-gray-900 leading-tight">{def.label}</h4>
                        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-1">
                          Target: {isBoolean ? (def.target ? 'COMPLETE' : 'INCOMPLETE') : def.target}
                        </p>
                      </div>
                      <div className={`text-2xl font-black tabular-nums ${isTargetHit ? 'text-green-500' : 'text-gray-900'}`}>
                        {isBoolean ? (
                          <span className="text-xs uppercase tracking-widest">
                            {kpi.isDone ? 'COMPLETE' : 'PENDING'}
                          </span>
                        ) : (
                          <>
                            {kpi.value}<span className="text-xs text-gray-300 font-normal ml-1">/{def.target}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {!isMonitorMode && (
                      <div className="flex items-center gap-3">
                        {!isBoolean ? (
                          <>
                            <div className="flex-1 flex items-center gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                              <button onClick={() => handleUpdateKPI(def.kpiName, Math.max(0, kpi.value - 1), false)}
                                className="h-8 w-8 flex items-center justify-center hover:bg-white rounded-lg transition shadow-sm">
                                <Minus className="h-3 w-3" />
                              </button>
                              <div className="flex-1 text-center font-mono font-black text-sm">{kpi.value}</div>
                              <button onClick={() => handleUpdateKPI(def.kpiName, kpi.value + 1, false)}
                                className="h-8 w-8 flex items-center justify-center hover:bg-white rounded-lg transition shadow-sm">
                                <Plus className="h-3 w-3" />
                              </button>
                              <div className="w-px h-4 bg-gray-200 mx-1" />
                              <button onClick={() => handleUpdateKPI(def.kpiName, kpi.value + 5, false)}
                                className="px-2 h-8 text-[10px] font-black hover:bg-white rounded-lg transition shadow-sm">
                                +5
                              </button>
                            </div>
                            <button 
                              onClick={() => handleUpdateKPI(def.kpiName, Math.max(kpi.value, def.target), !kpi.isDone)}
                              className={`px-4 h-10 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-sm ${
                                kpi.isDone 
                                  ? "bg-green-500 text-white shadow-green-500/20" 
                                  : "bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500/20"
                              }`}
                            >
                              HIT
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleUpdateKPI(def.kpiName, kpi.value, !kpi.isDone)}
                            className={`w-full h-11 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-sm flex items-center justify-center gap-2 ${
                              kpi.isDone 
                                ? "bg-green-500 text-white shadow-green-500/20" 
                                : "bg-gray-900 text-white hover:bg-black"
                            }`}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {kpi.isDone ? 'COMPLETED' : 'MARK COMPLETE'}
                          </button>
                        )}
                      </div>
                    )}
                    {isMonitorMode && (
                      <div className="flex items-center justify-end">
                        <Badge className={`font-black ${kpi.isDone ? 'bg-green-500' : 'bg-gray-100 text-gray-400'}`}>
                          {kpi.isDone ? 'COMPLETED' : 'IN PROGRESS'}
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Sprints Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-gray-900">SPRINT PLAN</h3>
                <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">The clock doesn't stop. Neither do we.</p>
              </div>
            </div>

            <div className="space-y-4">
              {sprints.map((sprint, idx) => {
                const sprintState = state?.sprints?.[idx] || state?.sprints?.get?.(idx) || { isDone: false };
                return (
                  <div key={sprint._id} style={cardStyle} className={`p-6 transition-all ${sprintState.isDone ? 'bg-green-50/30 border-green-200' : ''}`}>
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex gap-6 items-center">
                        <div className="text-center min-w-[80px]">
                          <div className="text-[10px] font-mono font-black text-orange-500 uppercase">SPRINT {idx + 1}</div>
                          <div className="text-xs font-bold text-gray-400 mt-0.5">{sprint.startTime} – {sprint.endTime}</div>
                        </div>
                        <div className="h-8 w-px bg-gray-100" />
                        <div>
                          <h4 className="text-xl font-black text-gray-900 tracking-tight">{sprint.sprintName}</h4>
                        </div>
                      </div>

                      {!isMonitorMode && (
                        <button 
                          onClick={() => handleToggleSprint(idx, !sprintState.isDone)}
                          className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-sm ${
                            sprintState.isDone 
                              ? "bg-green-500 text-white shadow-green-500/20" 
                              : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {sprintState.isDone ? "Done" : "Mark done"}
                        </button>
                      )}
                      {isMonitorMode && (
                        <Badge className={`font-black ${sprintState.isDone ? 'bg-green-500' : 'bg-gray-100 text-gray-400'}`}>
                          {sprintState.isDone ? 'FINISHED' : 'PENDING'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Comm Windows Section */}
          {comms.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-gray-900">COMMUNICATION WINDOWS</h3>
                  <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">Execute outreach. Log the status.</p>
                </div>
              </div>

              <div className="space-y-4">
                {comms.map((comm, idx) => {
                  const commState = state?.comms?.[idx] || state?.comms?.get?.(idx) || null;
                  return (
                    <div key={comm._id} style={cardStyle} className={`p-6 transition-all ${commState?.status === 'SENT' ? 'bg-green-50/30 border-green-200' : commState?.status === 'MISSED' ? 'bg-red-50/30 border-red-200' : ''}`}>
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex gap-6 items-center">
                          <div className="text-center min-w-[80px]">
                            <div className="text-[10px] font-mono font-black text-orange-500 uppercase">WINDOW</div>
                            <div className="text-xs font-bold text-gray-400 mt-0.5">{comm.scheduledTime}</div>
                          </div>
                          <div className="h-8 w-px bg-gray-100" />
                          <div>
                            <h4 className="text-xl font-black text-gray-900 tracking-tight">{comm.windowName}</h4>
                          </div>
                        </div>

                        {!isMonitorMode && (
                          <div className="flex items-center gap-2 w-full md:w-auto">
                            <button 
                              onClick={() => handleToggleComm(idx, 'SENT')}
                              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-sm ${
                                commState?.status === 'SENT' 
                                  ? "bg-green-500 text-white shadow-green-500/20" 
                                  : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                              }`}
                            >
                              <CheckCircle2 className="h-4 w-4" /> SENT
                            </button>
                            <button 
                              onClick={() => handleToggleComm(idx, 'MISSED')}
                              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-sm ${
                                commState?.status === 'MISSED' 
                                  ? "bg-red-500 text-white shadow-red-500/20" 
                                  : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                              }`}
                            >
                              <AlertCircle className="h-4 w-4" /> MISSED
                            </button>
                          </div>
                        )}
                        {isMonitorMode && (
                          <Badge className={`font-black ${commState?.status === 'SENT' ? 'bg-green-500' : commState?.status === 'MISSED' ? 'bg-red-500' : 'bg-gray-100 text-gray-400'}`}>
                            {commState?.status ? commState.status : 'PENDING'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Decisions & Reports */}
        <div className="space-y-8">
           {/* Rules Card */}
           <div className="p-8 rounded-[32px] bg-gray-900 text-white space-y-4 shadow-2xl relative overflow-hidden">
             <div className="absolute bottom-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl" />
             <div className="flex items-center gap-2 text-orange-500">
                <AlertCircle className="h-5 w-5" />
                <div className="text-[11px] font-mono font-black uppercase tracking-[0.2em]">The Arena Rule</div>
             </div>
             <p className="text-lg font-bold leading-relaxed italic text-orange-50">
               "If it's not logged, it didn't happen. If it didn't happen, we can't scale it."
             </p>
           </div>

           {/* Decisions Section */}
           <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Hard Decisions</h3>
              </div>
              <div style={cardStyle} className="p-6 space-y-4">
                {!isMonitorMode && (
                  <>
                    <textarea 
                      placeholder="Log a hard decision made today..."
                      value={decisionInput}
                      onChange={(e) => setDecisionInput(e.target.value)}
                      className="w-full h-24 bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-orange-500/5 transition-all resize-none font-medium"
                    />
                    <button 
                      onClick={handleAddDecision}
                      className="w-full py-4 bg-orange-500 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/20"
                    >
                      <Plus className="h-4 w-4" /> LOG DECISION
                    </button>
                  </>
                )}
                <div className="space-y-3">
                  {state?.decisions?.length > 0 ? (
                    state.decisions.map((d: any, i: number) => (
                      <div key={i} className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 text-xs font-medium text-gray-600 leading-relaxed">
                        {d.text}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-[10px] font-mono font-bold text-gray-300 uppercase tracking-widest">No decisions logged yet.</p>
                    </div>
                  )}
                </div>
              </div>
           </section>

           {/* EOD Report Section */}
           <section className="space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">End of Day Report</h3>
              </div>
              <div style={cardStyle} className="p-6 space-y-6">
                {!isMonitorMode && (
                  <div className="space-y-6">
                    {/* Goal Achieved */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold uppercase text-gray-400">1. Goal Achieved?</label>
                      <div className="flex gap-2">
                        {['Yes', 'Partially', 'No'].map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setEodData({ ...eodData, goalAchieved: opt })}
                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                              eodData.goalAchieved === opt
                                ? opt === 'Yes' ? 'bg-green-500/10 border-green-500/30 text-green-600 shadow-sm'
                                  : opt === 'Partially' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 shadow-sm'
                                  : 'bg-red-500/10 border-red-500/30 text-red-600 shadow-sm'
                                : 'bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* What Was Done */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold uppercase text-gray-400">2. What Was Done</label>
                      <textarea 
                        placeholder="Explain features developed, bugs fixed, research completed..."
                        value={eodData.whatWasDone}
                        onChange={(e) => setEodData({ ...eodData, whatWasDone: e.target.value })}
                        className="w-full min-h-[120px] bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-orange-500/5 transition-all font-medium"
                      />
                    </div>

                    {/* Live Links */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-mono font-bold uppercase text-gray-400">3. Live Links (Optional)</label>
                      
                      {/* Existing finalized links */}
                      {eodData.liveLinks.map((link, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-xs font-bold text-gray-900 truncate">{link.label}</span>
                            <span className="text-[10px] text-gray-400 font-mono truncate">{link.url}</span>
                          </div>
                          <div className="flex gap-2 shrink-0 ml-4">
                            <button onClick={() => setLinkDraft({ label: link.label, url: link.url, index: idx })} className="text-[10px] font-black text-gray-400 hover:text-orange-500 uppercase tracking-widest transition-all">
                              Edit
                            </button>
                            <button onClick={() => handleRemoveLiveLink(idx)} className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-all">
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Inline Add/Edit Form */}
                      {linkDraft !== null ? (
                        <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-3">
                          <input 
                            placeholder="Link Label (e.g. GitHub PR)"
                            value={linkDraft.label}
                            onChange={(e) => setLinkDraft({ ...linkDraft, label: e.target.value })}
                            className="w-full h-10 bg-white border border-gray-200 rounded-lg px-3 text-xs font-bold outline-none focus:border-orange-500"
                          />
                          <input 
                            placeholder="URL (https://...)"
                            value={linkDraft.url}
                            onChange={(e) => setLinkDraft({ ...linkDraft, url: e.target.value })}
                            className="w-full h-10 bg-white border border-gray-200 rounded-lg px-3 text-xs font-medium outline-none focus:border-orange-500"
                          />
                          <div className="flex gap-2 pt-1">
                            <button 
                              onClick={handleSaveLinkDraft}
                              className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                            >
                              Save Link
                            </button>
                            <button 
                              onClick={() => setLinkDraft(null)}
                              className="flex-1 py-2 bg-gray-200 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-gray-300 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setLinkDraft({ label: '', url: '' })}
                          className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 border border-gray-200 border-dashed rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="h-3 w-3" /> ADD LINK
                        </button>
                      )}
                    </div>

                    <button 
                      onClick={handleSubmitEOD}
                      disabled={isSubmittingEOD || !eodData.goalAchieved || !eodData.whatWasDone.trim()}
                      className={`w-full py-4 rounded-2xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                        isSubmittingEOD || !eodData.goalAchieved || !eodData.whatWasDone.trim()
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-gray-900 text-white hover:bg-black shadow-xl shadow-gray-900/10'
                      }`}
                    >
                      {isSubmittingEOD ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {state?.eodReport?.submittedAt ? 'UPDATE EOD REPORT' : 'SUBMIT EOD REPORT'}
                    </button>
                  </div>
                )}
                
                {state?.eodReport?.submittedAt && (
                  <div className="p-5 rounded-2xl bg-green-500/5 border border-green-500/10 space-y-4">
                    <div className="flex justify-between items-center border-b border-green-500/10 pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <div className="text-[10px] font-mono font-black text-green-600 uppercase tracking-widest">EOD Logged</div>
                      </div>
                      <div className="text-[9px] font-mono font-bold text-gray-400 uppercase">
                        {new Date(state.eodReport.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {isMonitorMode && (
                      <div className="space-y-4">
                        <div>
                          <div className="text-[9px] font-mono font-bold text-gray-400 uppercase mb-1">Goal Achieved</div>
                          <Badge className={`${
                            state.eodReport.goalAchieved === 'Yes' ? 'bg-green-500' : 
                            state.eodReport.goalAchieved === 'Partially' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}>
                            {state.eodReport.goalAchieved || 'N/A'}
                          </Badge>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono font-bold text-gray-400 uppercase mb-1">What Was Done</div>
                          <div className="text-xs text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
                            {state.eodReport.whatWasDone || state.eodReport.summary}
                          </div>
                        </div>
                        {state.eodReport.liveLinks?.filter((l: any) => l.label && l.url).length > 0 && (
                          <div>
                            <div className="text-[9px] font-mono font-bold text-gray-400 uppercase mb-1">Live Links</div>
                            <div className="space-y-2">
                              {state.eodReport.liveLinks.filter((l: any) => l.label && l.url).map((link: any, idx: number) => (
                                <a key={idx} href={link.url} target="_blank" rel="noreferrer" className="block p-2 bg-white rounded-lg border border-gray-100 text-[10px] font-bold text-orange-500 hover:border-orange-200 transition-all">
                                  {link.label} <span className="text-gray-400 font-mono font-normal ml-1">→ {link.url}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[9px] text-gray-400 text-center font-medium uppercase tracking-tighter">
                  Reports are synced to the command dashboard instantly.
                </p>
              </div>
           </section>

        </div>
      </div>
    </div>
  );
}
