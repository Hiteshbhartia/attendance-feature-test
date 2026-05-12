'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';

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

function fmtDate(iso?: string) {
  if (!iso) return 'Not provided';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return 'Not provided';
  }
}

export default function EmployeeDetail({ employeeId }: { employeeId?: string }) {
  const searchParams = useSearchParams();
  const queryEmployeeId = searchParams?.get('employeeId') || searchParams?.get('employeeid') || '';
  const effectiveEmployeeId = employeeId || queryEmployeeId;
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
  const [leaveBalance, setLeaveBalance] = useState<any>(null);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const [coachingSessions, setCoachingSessions] = useState<any[]>([]);

  const fetchCoaching = async (empId: string) => {
    try {
      const res = await fetch(`/api/coaching?search=${empId}&tab=all&limit=5`);
      const data = await res.json();
      if (data.ok && data.sessions) {
         setCoachingSessions(data.sessions.filter((s:any) => s.employeeId === empId));
      }
    } catch {
      setCoachingSessions([]);
    }
  };

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

  const fetchDetail = async (empId: string) => {
    try {
      const r = await fetch(`/api/employees/${empId}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) {
        setDetail(d.employee || null);
        setLeaveBalance(d.leaveBalance || null);
        setLeaveHistory(Array.isArray(d.leaveHistory) ? d.leaveHistory : []);
        setAttendanceSummary(d.attendanceSummary || null);
      }
    } catch {
      setDetail(null);
    }
  };

  const fetchHistory = async (empId: string, page = 1, opts?: { status?: string; start?: string; end?: string }) => {
    setHistoryLoading(true);
    try {
      const statusVal = opts?.status ?? historyStatus;
      const startVal = opts?.start ?? historyStart;
      const endVal = opts?.end ?? historyEnd;
      const params = new URLSearchParams({ employeeId: empId, page: String(page), limit: '25' });
      if (statusVal) params.set('status', statusVal);
      if (startVal && endVal) {
        params.set('start', startVal);
        params.set('end', endVal);
      }
      const r = await fetch(`/api/attendance/history?${params.toString()}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) {
        setHistoryRows(d.records || []);
        setHistoryPage(d.page || 1);
        setHistoryTotalPages(d.totalPages || 1);
      }
    } catch {
      setHistoryRows([]);
      setHistoryPage(1);
      setHistoryTotalPages(1);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(async me => {
        setUserRole(me.role || '');
        if (me.role === 'admin' || me.role === 'manager') {
          const e = await fetch('/api/employees?page=1&limit=100', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ users: [] }));
          const emps = (e.users || []).filter((u: any) => u.role === 'employee').map((u: any) => ({ _id: u._id, fullName: u.fullName }));
          setEmployees(emps);
          const first = effectiveEmployeeId || emps[0]?._id || '';
          setSelectedEmployee(first);
          setLoading(true);
          fetchStatus(first);
          if (first) {
            fetchDetail(first);
            fetchHistory(first, 1);
            fetchCoaching(first);
          }
        } else {
          const selfId = me.id || '';
          if (selfId) setSelectedEmployee(selfId);
          setLoading(true);
          fetchStatus();
          if (selfId && selfId !== 'admin') {
            fetchDetail(selfId);
            fetchHistory(selfId, 1);
            fetchCoaching(selfId);
          }
        }
      })
      .catch(() => {
        setLoading(true);
        fetchStatus();
      });
  }, []);

  useEffect(() => {
    if (!effectiveEmployeeId) return;
    if (userRole === 'admin' || userRole === 'manager') {
      if (selectedEmployee !== effectiveEmployeeId) {
        setSelectedEmployee(effectiveEmployeeId);
        setLoading(true);
        fetchStatus(effectiveEmployeeId);
        fetchDetail(effectiveEmployeeId);
        fetchHistory(effectiveEmployeeId, 1);
        fetchCoaching(effectiveEmployeeId);
      }
    }
  }, [effectiveEmployeeId, userRole]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const doCheckIn = () => {
    setClocking(true);
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        const r = await fetch('/api/attendance/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
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

  const doCheckOut = async () => {
    setClocking(true);
    const r = await fetch('/api/attendance/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json();
    if (d.ok) { flash('Clocked out!'); fetchStatus(); }
    else flash(d.error || 'Error');
    setClocking(false);
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

  const saveLeaveBalance = async () => {
    if (userRole !== 'admin' || !selectedEmployee) return;
    setLeaveSaving(true);
    try {
      const r = await fetch('/api/leaves/balance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          paid: leaveBalance?.paid,
          sick: leaveBalance?.sick,
          casual: leaveBalance?.casual,
          compOff: leaveBalance?.compOff,
          lop: leaveBalance?.lop,
          encashable: leaveBalance?.encashable,
          encashed: leaveBalance?.encashed,
          ratePerDay: leaveBalance?.ratePerDay,
        }),
      });
      const d = await r.json();
      if (d.balance) {
        setLeaveBalance(d.balance);
        flash('Leave balance updated');
      } else {
        flash(d.error || 'Failed to update balance');
      }
    } catch {
      flash('Failed to update balance');
    }
    setLeaveSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Profile */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
            {detail?.profilePhoto ? (
              <img src={detail.profilePhoto} alt={detail.fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-gray-500">{detail?.fullName?.split(' ').map((n: string) => n[0]).slice(0,2).join('').toUpperCase() || 'NA'}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="text-xl font-bold text-gray-900">{detail?.fullName || 'Employee Detail'}</div>
            <div className="text-xs text-gray-600">{detail?.email || 'Email not available'}</div>
            <div className="mt-1 text-[11px] text-gray-500 capitalize">{detail?.role || 'employee'} {detail?.jobRole ? `• ${detail.jobRole}` : ''}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5 text-xs">
          <div>
            <div className="text-gray-500">Team</div>
            <div className="text-gray-900 font-medium">{detail?.teamName || 'Not provided'}</div>
          </div>
          <div>
            <div className="text-gray-500">Office Zone</div>
            <div className="text-gray-900 font-medium">{detail?.officeZone || 'Not provided'}</div>
          </div>
          <div>
            <div className="text-gray-500">Reporting Manager</div>
            <div className="text-gray-900 font-medium">{detail?.manager?.fullName || 'Not assigned'}</div>
          </div>
          <div>
            <div className="text-gray-500">Date of Birth</div>
            <div className="text-gray-900 font-medium">{detail?.dateOfBirth || 'Not provided'}</div>
          </div>
          <div>
            <div className="text-gray-500">Joining Date</div>
            <div className="text-gray-900 font-medium">{fmtDate(detail?.createdAt)}</div>
          </div>
        </div>
      </div>

      {/* Attendance card */}
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
            onChange={(e) => {
              const next = e.target.value;
              setSelectedEmployee(next);
              setLoading(true);
              fetchStatus(next);
              if (next) {
                fetchDetail(next);
                fetchHistory(next, 1);
                fetchCoaching(next);
              }
            }}
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

      {userRole === 'admin' && selectedEmployee && leaveBalance && (
        <div className="mb-4 p-4 rounded-2xl" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
          <div className="text-sm font-semibold text-gray-900 mb-2">Leave Balance & Encashment</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { key: 'paid', label: 'Paid' },
              { key: 'sick', label: 'Sick' },
              { key: 'casual', label: 'Casual' },
              { key: 'compOff', label: 'Comp Off' },
              { key: 'lop', label: 'LOP' },
              { key: 'encashable', label: 'Encashable' },
              { key: 'encashed', label: 'Encashed' },
              { key: 'ratePerDay', label: 'Rate/Day' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-[10px] text-gray-600 mb-1">{field.label}</label>
                <input
                  type="number"
                  value={Number.isFinite(Number(leaveBalance?.[field.key])) ? Number(leaveBalance[field.key]) : 0}
                  onChange={(e) => {
                    const nextVal = Number(e.target.value);
                    setLeaveBalance((p: any) => ({ ...p, [field.key]: Number.isFinite(nextVal) ? nextVal : 0 }));
                  }}
                  className="w-full px-2 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#374151' }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={saveLeaveBalance}
            disabled={leaveSaving}
            className="mt-3 px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: '#f97316' }}
          >
            {leaveSaving ? 'Saving...' : 'Save Leave Balance'}
          </button>
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

            {/* Stats */}
            {att && att.sessions > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                <div className="bg-white rounded-xl p-3 border border-orange-100">
                  <div className="text-lg font-bold text-gray-800">{att.sessions}</div>
                  <div className="text-xs text-gray-700">Sessions</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-orange-100">
                  <div className="text-lg font-bold text-teal-600">{att.totalWorkFormatted}</div>
                  <div className="text-xs text-gray-700">Work Hours</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-orange-100">
                  <div className={`text-sm font-bold ${att.dayStatus === 'Late' ? 'text-orange-500' : 'text-teal-600'}`}>{att.dayStatus}</div>
                  <div className="text-xs text-gray-700">Status</div>
                </div>
              </div>
            )}

            {userRole === 'employee' && (
              <>
                <button
                  onClick={isIn ? doCheckOut : doCheckIn}
                  disabled={clocking}
                  className={`w-full py-3 rounded-full font-medium transition mb-3 ${
                    isIn
                      ? 'bg-white text-orange-500 border-2 border-orange-500 hover:bg-orange-50'
                      : 'bg-teal-600 text-white hover:bg-teal-700'
                  } disabled:opacity-60`}
                >
                  {clocking ? 'Please wait...' : isIn ? 'Clock Out' : 'Clock In'}
                </button>

                {isIn && (
                  <p className="text-center text-teal-600 text-sm">Currently active  -  GPS verified</p>
                )}

                {msg && (
                  <div className={`mt-3 p-3 rounded-xl text-sm text-center font-medium ${
                    msg.includes('Error') || msg.includes('denied') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                  }`}>{msg}</div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Timeline */}
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
              <div className="text-xs text-gray-700">Avg Work Hours</div>
              <div className="text-lg font-bold text-gray-800">{Math.floor((analytics.avgWorkMins || 0)/60)}h {(analytics.avgWorkMins || 0)%60}m</div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Attendance Summary */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Attendance Summary</h3>
        {attendanceSummary ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-lg font-bold text-gray-900">{attendanceSummary.totalDays || 0}</div>
              <div className="text-[10px] text-gray-600">Total Days</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-lg font-bold text-emerald-600">{attendanceSummary.presentDays || 0}</div>
              <div className="text-[10px] text-gray-600">Present</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-lg font-bold text-red-500">{attendanceSummary.absentDays || 0}</div>
              <div className="text-[10px] text-gray-600">Absent</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-lg font-bold text-orange-500">{attendanceSummary.lateDays || 0}</div>
              <div className="text-[10px] text-gray-600">Late</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-lg font-bold text-amber-600">{attendanceSummary.earlyDays || 0}</div>
              <div className="text-[10px] text-gray-600">Early</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500">No attendance summary available.</div>
        )}
      </div>

      {/* Work Schedule */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Shift & Schedule</h3>
        {detail?.workSchedule ? (
          <div className="space-y-2 text-xs text-gray-700">
            <div>Shift Type: <span className="font-semibold text-gray-900">{detail.workSchedule.shiftType || 'CUSTOM'}</span></div>
            <div>Work Timing: <span className="font-semibold text-gray-900">{detail.workSchedule.startTime} - {detail.workSchedule.endTime}</span></div>
            <div>Break Duration: <span className="font-semibold text-gray-900">{detail.workSchedule.breakDuration || 0} mins</span></div>
            <div>Week Offs: <span className="font-semibold text-gray-900">{(detail.workSchedule.weekOffs || []).join(', ') || 'Not set'}</span></div>
            {Array.isArray(detail.workSchedule.breaks) && detail.workSchedule.breaks.length > 0 && (
              <div className="pt-1">
                <div className="text-[11px] text-gray-500 mb-1">Breaks</div>
                <div className="space-y-1">
                  {detail.workSchedule.breaks.map((b: any, i: number) => (
                    <div key={`${b.name}-${i}`} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                      <span className="text-gray-700">{b.name || 'Break'}</span>
                      <span className="text-gray-600">{b.start} - {b.end} ({b.durationMinutes || 0}m)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-500">No schedule assigned yet.</div>
        )}
      </div>

      {/* Attendance History */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Attendance History</h3>
          <div className="flex items-center gap-2 text-xs">
            <select
              value={historyStatus}
              onChange={(e) => {
                const next = e.target.value;
                setHistoryStatus(next);
                if (selectedEmployee) fetchHistory(selectedEmployee, 1, { status: next });
              }}
              className="px-2 py-1 rounded-lg border border-gray-200 bg-white"
            >
              <option value="">All Status</option>
              <option value="On Time">On Time</option>
              <option value="Late">Late</option>
              <option value="Early">Early</option>
              <option value="Absent">Absent</option>
            </select>
            <input
              type="date"
              value={historyStart}
              onChange={(e) => setHistoryStart(e.target.value)}
              className="px-2 py-1 rounded-lg border border-gray-200 bg-white"
            />
            <input
              type="date"
              value={historyEnd}
              onChange={(e) => setHistoryEnd(e.target.value)}
              className="px-2 py-1 rounded-lg border border-gray-200 bg-white"
            />
            <button
              onClick={() => selectedEmployee && fetchHistory(selectedEmployee, 1)}
              className="px-3 py-1 rounded-lg text-white text-xs"
              style={{ background: '#f97316' }}
            >
              Apply
            </button>
          </div>
        </div>

        {historyLoading ? (
          <div className="text-xs text-gray-500">Loading history...</div>
        ) : historyRows.length === 0 ? (
          <div className="text-xs text-gray-500">No attendance history found.</div>
        ) : (
          <div className="space-y-2">
            {historyRows.map((row: any) => (
              <div key={row.date} className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <div className="font-semibold text-gray-900">{row.date}</div>
                <div className="text-gray-700">{row.dayStatus}</div>
                <div className="text-gray-700">Work: {Math.floor((row.totalWorkMins || 0)/60)}h {(row.totalWorkMins || 0)%60}m</div>
                <div className="text-gray-700">Break: {row.totalBreakMins || 0}m</div>
                <div className="text-gray-700">Late: {row.lateByMins || 0}m</div>
                <div className="text-gray-700">Early: {row.earlyByMins || 0}m</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
          <button
            disabled={historyPage <= 1}
            onClick={() => selectedEmployee && fetchHistory(selectedEmployee, historyPage - 1)}
            className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-50"
          >
            Prev
          </button>
          <span>Page {historyPage} of {historyTotalPages}</span>
          <button
            disabled={historyPage >= historyTotalPages}
            onClick={() => selectedEmployee && fetchHistory(selectedEmployee, historyPage + 1)}
            className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Leave History */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Leave History</h3>
        {leaveHistory.length === 0 ? (
          <div className="text-xs text-gray-500">No leave history available.</div>
        ) : (
          <div className="space-y-2">
            {leaveHistory.map((l: any) => (
              <div key={`${l._id}`} className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <div className="font-semibold text-gray-900">{l.type}</div>
                <div className="text-gray-700">{l.startDate} to {l.endDate}</div>
                <div className="text-gray-700">{l.days} day(s)</div>
                <div className={`text-xs font-semibold ${l.status === 'approved' ? 'text-emerald-600' : l.status === 'rejected' ? 'text-red-600' : 'text-orange-500'}`}>
                  {l.status}
                </div>
                <div className="text-gray-600">{l.reason || 'No reason'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance / KPI */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Performance & KPI</h3>
        <div className="text-xs text-gray-500">No performance records available in the system yet.</div>
      </div>

      {/* 1:1 Sessions & Timeline */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">1:1 History</h3>
        {coachingSessions.length === 0 ? (
          <div className="text-xs text-gray-500">No 1:1 sessions recorded.</div>
        ) : (
          <div className="space-y-4 border-l-2 border-gray-100 pl-4 ml-2">
            {coachingSessions.map((session: any) => (
               <div key={session._id} className="relative">
                 <div className="absolute -left-[23px] top-1 w-3 h-3 bg-white border-2 border-orange-500 rounded-full"></div>
                 <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                       <div>
                         <div className="font-semibold text-gray-900 text-sm">Session with {session.conductedByName}</div>
                         <div className="text-xs text-gray-500">{new Date(session.scheduledAt).toLocaleDateString('en-IN', { dateStyle: 'medium'})}</div>
                       </div>
                       <div className="text-[10px] font-bold px-2 py-1 rounded bg-orange-100 text-orange-600 uppercase tracking-wide">
                          {session.healthStatus.replace('-', ' ')}
                       </div>
                    </div>
                    {session.sharedNotes && (
                      <div className="text-xs text-gray-600 mt-2 p-2 bg-white rounded-xl border border-gray-100">
                        {session.sharedNotes}
                      </div>
                    )}
                    {session.actionItems?.length > 0 && (
                      <div className="mt-3">
                         <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Action Items</div>
                         <div className="space-y-1">
                           {session.actionItems.map((a: any) => (
                              <div key={a._id} className={`text-xs flex items-center gap-1.5 ${a.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                 <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'completed' ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
                                 {a.title}
                              </div>
                           ))}
                         </div>
                      </div>
                    )}
                 </div>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}






