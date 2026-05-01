'use client';
import { useEffect, useState } from 'react';
import { Clock, Camera } from 'lucide-react';
import SelfieCapture from '@/components/selfie-capture';

interface AttStatus {
  isCheckedIn: boolean;
  checkInTime: string | null;
  firstCheckIn: string | null;
  totalWorkMins: number;
  totalWorkFormatted: string;
  sessions: number;
  dayStatus: string;
  timeline: { time: string; label: string; type: string }[];
}

const IST_24H_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Kolkata',
};

const IST_MERIDIEM_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
};

function fmtIST24(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', IST_24H_OPTIONS);
}

function fmtISTMeridiem(iso: string) {
  const parts = new Intl.DateTimeFormat('en-IN', IST_MERIDIEM_OPTIONS).formatToParts(new Date(iso));
  return parts.find((p) => p.type === 'dayPeriod')?.value?.toUpperCase() || '';
}

export default function EmployeeDetail({ employeeId }: { employeeId?: string }) {
  const [att, setAtt] = useState<AttStatus | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [employees, setEmployees] = useState<{ _id: string; fullName: string }[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [msg, setMsg] = useState('');
  const [resetPwd, setResetPwd] = useState({ newPassword: '', confirmPassword: '' });
  const [resetting, setResetting] = useState(false);
  const [showSelfie, setShowSelfie] = useState(false);

  const fetchStatus = (empId?: string) => {
    const url = userRole === 'admin' || userRole === 'manager'
      ? `/api/attendance/employee?id=${empId || selectedEmployee || ''}`
      : '/api/attendance/status';
    fetch(url, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setAtt(d.attendance || d);
        setAnalytics(d.analytics || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(async me => {
        setUserRole(me.role || '');
        if (me.role === 'admin' || me.role === 'manager') {
          const e = await fetch('/api/employees', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ users: [] }));
          const emps = (e.users || []).filter((u: any) => u.role === 'employee').map((u: any) => ({ _id: u._id, fullName: u.fullName }));
          setEmployees(emps);
          const first = employeeId || emps[0]?._id || '';
          setSelectedEmployee(first);
          setLoading(true);
          fetchStatus(first);
        } else {
          setLoading(true);
          fetchStatus();
        }
      })
      .catch(() => {
        setLoading(true);
        fetchStatus();
      });
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const handleClockAction = () => {
    setShowSelfie(true);
  };

  const onSelfieCaptured = (image: string) => {
    if (att?.isCheckedIn) doCheckOut(image);
    else doCheckIn(image);
  };

  const doCheckIn = async (selfieImage: string) => {
    setClocking(true);
    flash('Verifying location...');
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        const r = await fetch('/api/attendance/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, selfieImage }),
        });
        const d = await r.json();
        if (d.ok) { flash('Clocked in!'); fetchStatus(); }
        else flash(d.error || 'Error');
        setClocking(false);
      },
      () => { flash('Location access denied'); setClocking(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const doCheckOut = async (selfieImage: string) => {
    setClocking(true);
    flash('Verifying location...');
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        const r = await fetch('/api/attendance/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, selfieImage }),
        });
        const d = await r.json();
        if (d.ok) { flash('Clocked out!'); fetchStatus(); }
        else flash(d.error || 'Error');
        setClocking(false);
      },
      () => { flash('Location access denied'); setClocking(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const isIn = att?.isCheckedIn;
  const doResetPassword = async () => {
    if (!selectedEmployee || userRole !== 'admin') return;
    if (!resetPwd.newPassword || !resetPwd.confirmPassword) {
      flash('Enter password and confirm');
      return;
    }
    setResetting(true);
    try {
      const r = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedEmployee,
          newPassword: resetPwd.newPassword,
          confirmPassword: resetPwd.confirmPassword,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        flash('Password reset updated');
        setResetPwd({ newPassword: '', confirmPassword: '' });
      } else {
        flash(d.error || 'Reset failed');
      }
    } catch {
      flash('Reset failed');
    }
    setResetting(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-300 p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-orange-500" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Attendance</h2>
        </div>
        <span className="text-gray-700 text-sm">Today's Detail</span>
      </div>
      {(userRole === 'admin' || userRole === 'manager') && employees.length > 0 && (
        <div className="mb-4">
          <select
            value={selectedEmployee}
            onChange={(e) => { setSelectedEmployee(e.target.value); setLoading(true); fetchStatus(e.target.value); }}
            className="px-3 py-2 rounded-xl text-sm focus:outline-none"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#374151' }}
          >
            {employees.map(e => <option key={e._id} value={e._id}>{e.fullName}</option>)}
          </select>
        </div>
      )}
      {userRole === 'admin' && selectedEmployee && (
        <div className="mb-4 p-4 rounded-2xl" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
          <div className="text-sm font-semibold text-gray-900 mb-2">Admin Direct Reset</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="password"
              value={resetPwd.newPassword}
              onChange={(e) => setResetPwd(p => ({ ...p, newPassword: e.target.value }))}
              placeholder="New password"
              className="px-3 py-2 rounded-xl text-sm focus:outline-none"
              style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#374151' }}
            />
            <input
              type="password"
              value={resetPwd.confirmPassword}
              onChange={(e) => setResetPwd(p => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="Confirm password"
              className="px-3 py-2 rounded-xl text-sm focus:outline-none"
              style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#374151' }}
            />
            <button
              onClick={doResetPassword}
              disabled={resetting}
              className="px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: '#f97316', color: '#fff' }}
            >
              {resetting ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
          <div className="text-[10px] text-gray-600 mt-2">Admin can reset password without approval.</div>
        </div>
      )}

      <div className="bg-orange-50 rounded-2xl p-6 md:p-8 border border-orange-200">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-orange-100 rounded w-1/2"/>
            <div className="h-32 bg-orange-100 rounded-full w-32 mx-auto"/>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-6">
              <div className="flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 border-gray-300 bg-white">
                <span className="text-2xl md:text-3xl font-bold text-gray-800">
                  {att?.firstCheckIn ? fmtIST24(att.firstCheckIn) : '--:--'}
                </span>
                <span className="text-gray-400 text-xs mt-1">
                  {att?.firstCheckIn ? fmtISTMeridiem(att.firstCheckIn) : ''}
                </span>
              </div>
            </div>

            {att && att.sessions > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                <div className="bg-white rounded-xl p-3 border border-orange-100">
                  <div className="text-lg font-bold text-gray-800">{att.sessions}</div>
                  <div className="text-xs text-gray-700">Sessions</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-orange-100">
                  <div className="text-lg font-bold text-teal-600">{att.totalWorkFormatted}</div>
                  <div className="text-xs text-gray-700">Worked</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-orange-100">
                  <div className={`text-sm font-bold ${att.dayStatus === 'Late' ? 'text-orange-500' : 'text-teal-600'}`}>{att.dayStatus}</div>
                  <div className="text-xs text-gray-700">Status</div>
                </div>
              </div>
            )}

            <button
              onClick={handleClockAction}
              disabled={clocking}
              className={`w-full py-3 rounded-full font-medium transition mb-3 ${
                isIn
                  ? 'bg-white text-orange-500 border-2 border-orange-500 hover:bg-orange-50'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              } disabled:opacity-60`}
            >
              {clocking ? 'Please wait...' : isIn ? 'Clock Out with Selfie' : 'Clock In with Selfie'}
            </button>

            {isIn && (
              <p className="text-center text-teal-600 text-sm">Location & Biometric Verified</p>
            )}

            {msg && (
              <div className={`mt-3 p-3 rounded-xl text-sm text-center font-medium ${
                msg.includes('Error') || msg.includes('denied') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
              }`}>{msg}</div>
            )}
          </>
        )}
      </div>

      {att?.timeline && att.timeline.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Today's Timeline</h3>
          <div className="space-y-2">
            {att.timeline.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ev.type === 'checkin' ? 'bg-teal-500' : 'bg-gray-400'}`}/>
                <span className="text-sm text-gray-700">{ev.label}</span>
                <span className="text-xs text-gray-400 ml-auto">{ev.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {analytics && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-600 mb-3">30-Day Pattern</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-xs text-gray-700">Late Frequency</div>
              <div className="text-lg font-bold text-orange-500">{analytics.lateRate || 0}%</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-xs text-gray-700">Early Pattern</div>
              <div className="text-lg font-bold text-green-600">{analytics.earlyRate || 0}%</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-xs text-gray-700">On Time Rate</div>
              <div className="text-lg font-bold text-teal-600">{analytics.onTimeRate || 0}%</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-xs text-gray-700">Avg Work</div>
              <div className="text-lg font-bold text-gray-800">{Math.floor((analytics.avgWorkMins || 0)/60)}h {(analytics.avgWorkMins || 0)%60}m</div>
            </div>
          </div>
        </div>
      )}
      <SelfieCapture open={showSelfie} onClose={() => setShowSelfie(false)} onCapture={onSelfieCaptured} />
    </div>
  );
}


