'use client';
import { useEffect, useState, useRef } from 'react';
import EmployeeSidebar from '@/components/employee-sidebar';
import SelfieCapture from '@/components/selfie-capture';
import { AlertCircle, CheckCircle2, Camera } from 'lucide-react';

const BREAK_LIMIT_MINS = 45;

function fmtClock(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}
function fmtHHMMtoISTLabel(v?: string) {
  const [hh, mm] = String(v || '').split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return v || '10:00';
  const h12 = hh % 12 || 12;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

const TIMELINE_DOT: Record<string, string> = {
  checkin: 'bg-emerald-500', checkout: 'bg-gray-600', break_start: 'bg-yellow-400', break_end: 'bg-indigo-500', field_exit: 'bg-blue-500', field_return: 'bg-emerald-500',
};

export default function MyAttendance() {
  const [att, setAtt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [, forceTick] = useState(0);
  const [showSelfie, setShowSelfie] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ endpoint: string, body: any } | null>(null);

  const fetchStatus = () => {
    fetch('/api/attendance/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setAtt(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Global ticker for UI updates every second
  useEffect(() => {
    const interval = setInterval(() => {
      forceTick(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getLiveWorkSeconds = () => {
    if (!att) return 0;
    let total = (att.totalWorkMins || 0) * 60;
    if (att.isCheckedIn && !att.isOnBreak && att.sessions?.length > 0) {
      const lastSession = att.sessions[att.sessions.length - 1];
      if (lastSession?.checkIn && !lastSession?.checkOut) {
        const now = Date.now();
        const checkIn = new Date(lastSession.checkIn).getTime();
        total += Math.floor((now - checkIn) / 1000);
      }
    }
    return total;
  };

  const getBreakMinutes = () => {
    if (!att) return 0;
    let total = att.totalBreakMins || 0;
    if (att.isOnBreak && att.sessions?.length > 0) {
      const lastSession = att.sessions[att.sessions.length - 1];
      if (lastSession?.checkIn && !lastSession?.checkOut && lastSession.type === 'break') {
        const now = Date.now();
        const checkIn = new Date(lastSession.checkIn).getTime();
        total += Math.floor((now - checkIn) / 60000);
      }
    }
    return total;
  };





  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const doAction = async (endpoint: string, body: any = {}) => {
    setClocking(true);
    flash('Verifying location...', true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 });
      }).catch(() => null);

      if (!pos) {
        flash('Location required for attendance.', false);
        setClocking(false);
        return;
      }

      const finalBody = {
        ...body,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalBody)
      });
      const d = await r.json();
      
      if (d.ok || d.success) {
        flash(getSuccessMsg(body), true);
        await fetchStatus(); // 🔥 FORCE UI REFRESH
      } else {
        flash(d.error || 'Verification failed.', false);
      }
    } catch (err) {
      console.error("ACTION FAILED:", err);
      flash('Network error or server failed.', false);
    }
    setClocking(false);
  };

  const handleActionWithSelfie = (endpoint: string, body: any) => {
    setPendingAction({ endpoint, body });
    setShowSelfie(true);
  };

  const onSelfieCaptured = async (image: string, faceFingerprint?: string) => {
    if (!pendingAction) return;
    const action = pendingAction;
    
    try {
      await doAction(action.endpoint, { 
        ...action.body, 
        selfieImage: image,
        faceFingerprint: faceFingerprint || ''
      });

      // 🔥 HARD RESET STATE
      setPendingAction(null);
      setShowSelfie(false);

      // 🔥 FORCE REFRESH FROM SERVER
      await fetchStatus();
    } catch (err) {
      console.error("CAPTURE FLOW ERROR:", err);
      setPendingAction(null);
      setShowSelfie(false);
    }
  };

  const markOffTomorrow = async () => {
    if (att?.isOffTomorrow) return;
    setLeaveSaving(true);
    try {
      const r = await fetch('/api/leaves/off-tomorrow', { method: 'POST' });
      const d = await r.json();
      if (d.ok) {
        flash('Marked off for tomorrow œ…', true);
        fetchStatus();
      } else {
        flash(d.error || 'Failed to mark off', false);
      }
    } catch {
      flash('Network error', false);
    }
    setLeaveSaving(false);
  };

  const getSuccessMsg = (body: any) => {
    if (body.type === 'break_start') return 'Break started';
    if (body.type === 'break_end') return 'Break ended - welcome back';
    return 'Action successful';
  };

  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 24, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  const workMode = att?.workMode || 'Absent';
  const modeColor: Record<string, string> = { Present: '#10b981', Break: '#f59e0b', Field: '#6366f1', Absent: '#9ca3af' };
  const breakPct = att?.totalBreakMins ? Math.min(100, Math.round((att.totalBreakMins / BREAK_LIMIT_MINS) * 100)) : 0;

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <EmployeeSidebar />
      <div className="md:ml-64 pb-24 md:pb-12">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

          {msg && (
            <div className={`px-6 py-4 rounded-2xl text-sm font-semibold border shadow-sm transition-all animate-in fade-in slide-in-from-top-2 ${msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {msg.text}
            </div>
          )}

          <div style={card} className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: modeColor[workMode] }}/>
                  <span className="text-sm font-bold uppercase tracking-wider" style={{ color: modeColor[workMode] }}>{workMode}</span>
                </div>
                <div className="text-sm text-gray-500 font-medium">{today}</div>
              </div>
              {att?.dayStatus && (
                <span className={`text-xs font-bold px-4 py-2 rounded-full border ${att.dayStatus === 'Late' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                  {att.dayStatus}
                </span>
              )}
            </div>

            <div className="text-center py-10 my-4 bg-gray-50/50 rounded-3xl border border-gray-100">
              <div className="text-6xl font-black tracking-tighter tabular-nums" style={{ color: modeColor[workMode] }}>
                {fmtClock(getLiveWorkSeconds())}
              </div>
              <p className="text-sm text-gray-400 mt-3 font-medium uppercase tracking-widest">Total Work Hours</p>
              {att?.checkInTime && <p className="text-xs text-gray-400 mt-2 font-medium">Shift started at {fmtTime(att.checkInTime)}</p>}
            </div>

            {(att?.totalBreakMins > 0 || att?.isOnBreak) && (
              <div className="mb-8 p-5 rounded-2xl bg-orange-50/30 border border-orange-100">
                <div className="flex justify-between text-xs font-bold mb-3">
                  <span className="text-orange-600 uppercase tracking-wide">Break Usage</span>
                  <span className={breakPct >= 100 ? 'text-red-600' : 'text-orange-600'}>
                    {getBreakMinutes()}m / {BREAK_LIMIT_MINS}m
                  </span>
                </div>
                <div className="w-full bg-gray-200/50 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round((getBreakMinutes() / BREAK_LIMIT_MINS) * 100))}%`, background: getBreakMinutes() >= BREAK_LIMIT_MINS ? '#ef4444' : '#f59e0b' }}/>
                </div>
              </div>
            )}

            <div className="mb-8 p-4 rounded-2xl bg-emerald-50/30 border border-emerald-100 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-sm font-bold text-emerald-700">Location Secure</p>
                <p className="text-[11px] text-emerald-600/80 font-medium tracking-wide">Verification mandatory for all sessions</p>
              </div>
            </div>

            <div className="space-y-4">
              {!att?.isCheckedIn && !att?.isOnBreak && !att?.isInField && (
                <button onClick={() => handleActionWithSelfie('/api/attendance/checkin', {})} disabled={clocking}
                  className="w-full py-5 rounded-2xl font-black text-lg bg-emerald-500 text-white shadow-xl shadow-emerald-200 hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50">
                  {clocking ? 'VERIFYING...' : 'CLOCK IN WITH SELFIE'}
                </button>
              )}

              {att?.isCheckedIn && (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => doAction('/api/attendance/checkout', { type: 'break_start' })} disabled={clocking}
                    className="py-5 rounded-2xl font-bold text-sm bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 transition-all">
                    START BREAK
                  </button>
                  <button onClick={() => handleActionWithSelfie('/api/attendance/checkout', {})} disabled={clocking}
                    className="py-5 rounded-2xl font-bold text-sm bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-all">
                    CLOCK OUT
                  </button>
                </div>
              )}

              {att?.isOnBreak && (
                <button onClick={() => handleActionWithSelfie('/api/attendance/checkin', { type: 'break_end' })} disabled={clocking}
                  className="w-full py-5 rounded-2xl font-bold text-lg bg-indigo-500 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-600 active:scale-[0.98] transition-all">
                  RESUME WORK
                </button>
              )}

              <div className="pt-4 border-t border-gray-100">
                <button 
                  onClick={markOffTomorrow}
                  disabled={leaveSaving || att?.isOffTomorrow}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    att?.isOffTomorrow 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${att?.isOffTomorrow ? 'bg-gray-300' : 'bg-orange-400'}`} />
                  {leaveSaving ? 'MARKING...' : att?.isOffTomorrow ? 'OFF MARKED FOR TOMORROW' : 'MARK OFF TOMORROW'}
                </button>
                {!att?.isOffTomorrow && (
                  <p className="text-[10px] text-gray-400 text-center mt-2 font-medium tracking-wide">
                    Click to inform team you won't be available tomorrow
                  </p>
                )}
              </div>
            </div>
          </div>

          {att?.timeline?.length > 0 && (
            <div style={card} className="p-8">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6">Today's Timeline</h3>
              <div className="space-y-6">
                {att.timeline.map((ev: any, i: number) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className={`w-3 h-3 rounded-full mt-1 ${TIMELINE_DOT[ev.type] || 'bg-gray-400'} ring-4 ring-white shadow-sm`}/>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">{ev.label}</p>
                      <p className="text-xs text-gray-400 font-medium">{ev.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <SelfieCapture open={showSelfie} onClose={() => setShowSelfie(false)} onCapture={onSelfieCaptured} />
    </div>
  );
}




