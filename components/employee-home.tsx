'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Clock, CheckCircle, XCircle, MapPin, Menu, X, Home, User, Bell, Camera } from 'lucide-react';
import EmployeeNav from '@/components/employee-nav';
import NoticesEmployee from '@/components/notices-employee';
import SelfieCapture from '@/components/selfie-capture';

interface User { id: string; email: string; fullName: string; role: string; }

const MOBILE_TABS = [
  { label: 'Home',          href: '/home',    icon: Home  },
  { label: 'My Attendance', href: '/clock',   icon: Clock },
  { label: 'My Profile',    href: '/profile', icon: User  },
  { label: 'Notices',       href: '/notices', icon: Bell  },
];

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function fmtMins(m: number) {
  if (!m) return '0m';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
}

export default function EmployeeHome({ user }: { user: User }) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [att, setAtt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [showSelfie, setShowSelfie] = useState(false);
  const [pendingAction, setPendingAction] = useState<'in' | 'out' | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    fetch('/api/attendance/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setAtt(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.profilePhoto) setProfilePhoto(d.profilePhoto); })
      .catch(() => {});
  }, []);

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleActionWithSelfie = (action: 'in' | 'out') => {
    setPendingAction(action);
    setShowSelfie(true);
  };

  const onSelfieCaptured = (image: string) => {
    if (pendingAction === 'in') doCheckInCoords(image);
    else if (pendingAction === 'out') doCheckOutCoords(image);
    setPendingAction(null);
  };

  const doCheckInCoords = async (selfieImage: string) => {
    setClocking(true);
    flash('Verifying location...', true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 });
      }).catch(() => null);

      const r = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos?.coords.latitude, lng: pos?.coords.longitude, selfieImage }),
      });
      const d = await r.json();
      if (d.ok) {
        flash(`Checked in! Action successful.`, true);
        fetchStatus();
      } else {
        flash(d.error || 'Check-in failed.', false);
      }
    } catch {
      flash('Network error.', false);
    }
    setClocking(false);
  };

  const doCheckOutCoords = async (selfieImage: string) => {
    setClocking(true);
    flash('Verifying location...', true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 });
      }).catch(() => null);

      const r = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos?.coords.latitude, lng: pos?.coords.longitude, selfieImage }),
      });
      const d = await r.json();
      if (d.ok) {
        flash(`Checked out! Action successful.`, true);
        fetchStatus();
      } else {
        flash(d.error || 'Check-out failed.', false);
      }
    } catch {
      flash('Network error.', false);
    }
    setClocking(false);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const isIn = att?.isCheckedIn;
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata',
  });

  const status = loading ? null : (
    isIn ? { color: 'text-green-700', text: `-  Checked In at ${att?.firstCheckIn ? fmtTime(att.firstCheckIn) : '--'}` } :
    (att?.sessions > 0 ? { color: 'text-gray-600', text: `œ“ Checked Out  -  Worked ${att.totalWorkFormatted}` } :
    { color: 'text-gray-700', text: '-  Not Checked In Yet' })
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900">Gharpayy</div>
              <div className="text-sm font-bold text-orange-500">ARENA OS</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-orange-500 border border-gray-200 rounded-lg px-3 py-1.5 transition">
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
            <button onClick={() => setMobileMenuOpen(v => !v)} className="md:hidden text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg p-2 transition">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200">
          {MOBILE_TABS.map(tab => (
            <button key={tab.href} onClick={() => { router.push(tab.href); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition text-left">
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="hidden md:block"><EmployeeNav /></div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Hi, {user.fullName.split(' ')[0]} ðŸ‘‹</h1>
          <p className="text-gray-700 text-sm mt-0.5">{today}</p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="h-36 flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a6e 0%, #2d2d9f 50%, #6b6bdd 100%)' }}>
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }}/>
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center overflow-hidden">
                {profilePhoto ? <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-white">{initials(user.fullName)}</span>}
              </div>
              <div className="text-center">
                <div className="text-white font-semibold text-base">{user.fullName}</div>
                <div className="text-white/60 text-xs capitalize">{user.role}</div>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className={`rounded-2xl px-4 py-3 border ${loading ? 'bg-gray-50 border-gray-100' : (isIn ? 'bg-green-50 border-green-200' : (att?.sessions > 0 ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-100'))}`}>
              {loading ? <div className="h-5 w-40 bg-gray-200 rounded animate-pulse"/> : <p className={`text-sm font-semibold ${status?.color}`}>{status?.text}</p>}
            </div>

            {!loading && att?.sessions > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'First In', value: att.firstCheckIn ? fmtTime(att.firstCheckIn) : '--' },
                  { label: 'Sessions', value: String(att.sessions) },
                  { label: 'Worked',   value: att.totalWorkFormatted },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{s.label}</div>
                    <div className="text-sm font-bold text-gray-800">{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {loading ? <div className="h-14 bg-gray-100 rounded-2xl animate-pulse"/> : (
              isIn ? (
                <button onClick={() => handleActionWithSelfie('out')} disabled={clocking} className="w-full py-4 rounded-2xl font-bold text-base bg-white text-orange-500 border-2 border-orange-500 hover:bg-orange-50 active:scale-[0.98] transition disabled:opacity-60 shadow-sm">
                  {clocking ? 'Processing...' : 'Clock Out with Selfie'}
                </button>
              ) : (
                <button onClick={() => handleActionWithSelfie('in')} disabled={clocking} className="w-full py-4 rounded-2xl font-bold text-base bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.98] transition disabled:opacity-60 shadow-sm">
                  {clocking ? 'Processing...' : 'Clock In with Selfie'}
                </button>
              )
            )}

            <div className="flex items-center justify-center gap-1.5">
              <MapPin className="w-3 h-3 text-gray-400"/>
              <p className="text-xs text-gray-400 text-center">Location & Biometric Verified</p>
            </div>

            <button onClick={() => router.push('/clock')} className="w-full py-2.5 rounded-2xl text-sm font-medium text-orange-500 border border-orange-200 hover:bg-orange-50 transition">
              View Full Attendance Detail †’
            </button>

            {msg && (
              <div className={`flex items-start gap-2 p-3.5 rounded-2xl text-sm font-medium border ${msg.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {msg.ok ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600"/> : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500"/>}
                <span>{msg.text}</span>
              </div>
            )}
          </div>
        </div>
        <NoticesEmployee />
      </div>
      <SelfieCapture open={showSelfie} onClose={() => setShowSelfie(false)} onCapture={onSelfieCaptured} />
    </div>
  );
}

