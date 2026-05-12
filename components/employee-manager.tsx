'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, Upload, X, Trash2, Eye, EyeOff,
  CheckCircle, AlertCircle, Download, RefreshCw
} from 'lucide-react';
import { SHIFT_TEMPLATES, SHIFT_TYPE_LABELS, WEEK_DAYS, ShiftType, BreakItem } from '@/lib/shift-templates';

interface Employee {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
}

interface CSVRow {
  fullName: string;
  email: string;
  password: string;
  role: string;
  dateOfBirth?: string;
  teamName?: string;
  jobRole?: string;
  officeZoneName?: string;
  managerEmail?: string;
  status?: 'pending' | 'ok' | 'error';
  error?: string;
}

const ROLES = ['employee', 'manager', 'admin'];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h ago`;
  return 'Just now';
}

const COLORS = ['bg-blue-200','bg-purple-200','bg-yellow-200','bg-green-200','bg-pink-200','bg-orange-200'];
const TEXT_COLORS = ['text-blue-700','text-purple-700','text-yellow-700','text-green-700','text-pink-700','text-orange-700'];
function colorIdx(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % COLORS.length;
  return h;
}
function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [userRole, setUserRole] = useState('');

  // Manual form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // CSV
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Bulk shift assignment
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkShiftType, setBulkShiftType] = useState<ShiftType>('FT_MAIN');
  const [bulkStart, setBulkStart] = useState(SHIFT_TEMPLATES.FT_MAIN.workStart);
  const [bulkEnd, setBulkEnd] = useState(SHIFT_TEMPLATES.FT_MAIN.workEnd);
  const [bulkBreaks, setBulkBreaks] = useState<BreakItem[]>(SHIFT_TEMPLATES.FT_MAIN.breaks);
  const [bulkWeekOffs, setBulkWeekOffs] = useState<string[]>(SHIFT_TEMPLATES.FT_MAIN.weekOffs);
  const [bulkSaving, setBulkSaving] = useState(false);

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    if (selectedIds.length === employees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e._id));
    }
  };

  const applyBulkTemplate = (type: ShiftType) => {
    if (type === 'CUSTOM') return;
    const t = SHIFT_TEMPLATES[type];
    setBulkStart(t.workStart);
    setBulkEnd(t.workEnd);
    setBulkBreaks(t.breaks);
    setBulkWeekOffs(t.weekOffs);
  };

  const saveBulkShift = async () => {
    if (selectedIds.length === 0) return;
    setBulkSaving(true);
    try {
      const body: any = {
        userIds: selectedIds,
        shiftType: bulkShiftType,
        startTime: bulkStart,
        endTime: bulkEnd,
        breaks: bulkBreaks,
        weekOffs: bulkWeekOffs,
      };
      const r = await fetch('/api/work-schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.ok) {
        flash(`Shift assigned to ${selectedIds.length} employee(s).`, true);
        setBulkOpen(false);
        setSelectedIds([]);
      } else {
        flash(d.error || 'Bulk update failed', false);
      }
    } catch {
      flash('Bulk update failed', false);
    }
    setBulkSaving(false);
  };

  const fetchEmployees = () => {
    fetch('/api/employees?page=1&limit=100', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.users) {
          setEmployees(d.users);
          setSelectedIds([]);
        } else if (d.error) {
          // Surface API errors so they're visible instead of silently showing 0
          flash(d.error, false);
        }
      })
      .catch(() => flash('Failed to load employees', false))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d?.role) setUserRole(d.role); }).catch(() => {});
  }, []);

  // Manual create
  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim().toLowerCase(), password, role }),
      });
      const d = await r.json();
      if (d.ok) {
        flash(`${fullName} added successfully.`, true);
        setFullName(''); setEmail(''); setPassword(''); setRole('employee');
        setShowManual(false);
        fetchEmployees();
      } else {
        flash(d.error || 'Failed to create employee', false);
      }
    } catch {
      flash('Network error. Try again.', false);
    }
    setSubmitting(false);
  };

  // CSV parsing
  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const rows: CSVRow[] = [];
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const hasHeader = header.some(h => h.includes('name') || h.includes('email'));
      const start = hasHeader ? 1 : 0;
      const idx = (name: string) => header.findIndex(h => h === name || h.replace(/\s+/g, '') === name.replace(/\s+/g, ''));

      for (let i = start; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length < 3) continue;
        const get = (key: string, fallbackIndex?: number) => {
          const index = hasHeader ? idx(key) : (fallbackIndex ?? -1);
          return index >= 0 ? (parts[index] || '') : '';
        };

        rows.push({
          fullName: get('full name', 0) || get('name', 0),
          email: get('email', 1),
          password: get('password', 2) || 'Pass@1234',
          role: userRole === 'manager' ? 'employee' : (get('role', 3).toLowerCase() || 'employee'),
          dateOfBirth: get('dob') || get('date of birth'),
          teamName: get('team') || get('team name'),
          jobRole: get('job role') || get('jobrole'),
          officeZoneName: get('office zone') || get('zone') || get('officezonename'),
          managerEmail: get('manager email') || get('manager'),
          status: 'pending',
        });
      }
      setCsvRows(rows);
      setShowCSV(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCSVImport = async () => {
    setImporting(true);
    const updated = [...csvRows];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === 'ok') continue;
      try {
        const r = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: updated[i].fullName,
            email: updated[i].email.toLowerCase(),
            password: updated[i].password,
            role: userRole === 'manager' ? 'employee' : (ROLES.includes(updated[i].role) ? updated[i].role : 'employee'),
            dateOfBirth: updated[i].dateOfBirth,
            teamName: updated[i].teamName,
            jobRole: updated[i].jobRole,
            officeZoneName: updated[i].officeZoneName,
            managerEmail: updated[i].managerEmail,
          }),
        });
        const d = await r.json();
        if (d.ok) {
          updated[i] = { ...updated[i], status: 'ok' };
        } else {
          updated[i] = { ...updated[i], status: 'error', error: d.error || 'Failed' };
        }
      } catch {
        updated[i] = { ...updated[i], status: 'error', error: 'Network error' };
      }
      setCsvRows([...updated]);
    }
    setImporting(false);
    const ok = updated.filter(r => r.status === 'ok').length;
    const err = updated.filter(r => r.status === 'error').length;
    flash(`Import complete: ${ok} created, ${err} failed`, err === 0);
    fetchEmployees();
  };

  // Delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? This will delete their account but keep attendance records.`)) return;
    setDeleting(id);
    try {
      const r = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.ok) {
        flash(`${name} removed.`, true);
        setEmployees(prev => prev.filter(e => e._id !== id));
      } else {
        flash(d.error || 'Failed to delete', false);
      }
    } catch {
      flash('Network error', false);
    }
    setDeleting(null);
  };

  // CSV template download
  const downloadTemplate = () => {
    const csv = [
      'Full Name,Email,Password,Role,DOB,Team,Job Role,Office Zone,Manager Email',
      'Satvik Sharma,satvik@gharpayy.com,Pass@1234,employee,1998-07-12,MWB MORE,full-time,KORA CORE,manager@gharpayy.com',
      'Pulkit Gupta,pulkit@gharpayy.com,Pass@1234,employee,1997-03-05,KORA CORE,full-time,MWB MORE,manager@gharpayy.com',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gharpayy_employees_template.csv';
    a.click();
  };

  return (
    <div className="space-y-4">

      {/* Header card */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Employee Management</h2>
              <p className="text-xs text-gray-700 mt-0.5">{employees.length} accounts  -  Admin/Manager</p>
            </div>
          </div>
          <button onClick={fetchEmployees} className="p-2 rounded-xl hover:bg-gray-100 transition">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowManual(true)}
            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-2xl transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
          <div className="relative">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-2xl border border-gray-200 transition"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVFile} className="hidden" />
          </div>
        </div>

        {/* CSV template download */}
        <button
          onClick={downloadTemplate}
          className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-orange-500 hover:text-orange-600 py-2"
        >
          <Download className="w-3.5 h-3.5" />
          Download CSV Template
        </button>
      </div>

      {/* Flash message */}
      {msg && (
        <div className={`flex items-start gap-2 p-4 rounded-2xl text-sm font-medium border ${
          msg.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {msg.ok
            ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
            : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Employee list */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6">
        <h3 className="font-bold text-gray-800 mb-4 text-sm">All Employees ({employees.length})</h3>
        {userRole === 'admin' && (
          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={employees.length > 0 && selectedIds.length === employees.length}
                onChange={toggleSelectAll}
              />
              Select all
            </label>
            {selectedIds.length > 0 && (
              <button
                onClick={() => setBulkOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                style={{ background: '#f97316' }}
              >
                Bulk Assign Shift ({selectedIds.length})
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl"/>)}
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-10">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No employees yet</p>
            <p className="text-gray-300 text-xs mt-1">Add manually or import CSV</p>
          </div>
        ) : (
          <div className="space-y-2">
            {employees.map(emp => {
              const ci = colorIdx(emp.fullName);
              return (
                <div key={emp._id}
                  className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100 hover:border-gray-200 transition cursor-pointer"
                  onClick={() => router.push(`/employee-detail?employeeId=${emp._id}`)}>
                  <div className="flex items-center gap-3">
                    {userRole === 'admin' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(emp._id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(emp._id)}
                      />
                    )}
                    <div className={`w-10 h-10 rounded-full ${COLORS[ci]} flex items-center justify-center text-xs font-bold ${TEXT_COLORS[ci]} flex-shrink-0`}>
                      {initials(emp.fullName)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{emp.fullName}</p>
                      <p className="text-xs text-gray-700">{emp.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                        emp.role === 'admin' ? 'bg-red-100 text-red-700' :
                        emp.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>{emp.role}</span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(emp.createdAt)}</p>
                    </div>
                    {userRole !== 'manager' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(emp._id, emp.fullName); }}
                        disabled={deleting === emp._id}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual create modal */}
      {showManual && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4"
          onClick={() => setShowManual(false)}>
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-md shadow-2xl p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800">{userRole === 'manager' ? 'Add Team Member' : 'Add Employee'}</h3>
              <button onClick={() => setShowManual(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-700" />
              </button>
            </div>

            <form onSubmit={handleManualCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Full Name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Satvik Sharma" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)}
                  type="email" placeholder="satvik@gharpayy.com" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Password</label>
                <div className="relative">
                  <input value={password} onChange={e => setPassword(e.target.value)}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Min 6 characters" required minLength={6}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {userRole !== 'manager' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Role</label>
                  <select value={role} onChange={e => setRole(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}
              <button type="submit" disabled={submitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-2xl transition disabled:opacity-60 mt-2">
                {submitting ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV preview modal */}
      {showCSV && csvRows.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4"
          onClick={() => { if (!importing) setShowCSV(false); }}>
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-800">CSV Preview</h3>
                <p className="text-xs text-gray-700 mt-0.5">{csvRows.length} employees found</p>
              </div>
              {!importing && (
                <button onClick={() => setShowCSV(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-700" />
                </button>
              )}
            </div>

            <div className="p-4 space-y-2">
              {csvRows.map((row, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${
                  row.status === 'ok' ? 'bg-green-50 border-green-200' :
                  row.status === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-gray-50 border-gray-100'
                }`}>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{row.fullName}</p>
                    <p className="text-xs text-gray-700">{row.email}  -  {row.role}</p>
                    {row.error && <p className="text-xs text-red-500 mt-0.5">{row.error}</p>}
                  </div>
                  <div className="flex-shrink-0">
                    {row.status === 'ok' && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {row.status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                    {row.status === 'pending' && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={handleCSVImport}
                disabled={importing || csvRows.every(r => r.status === 'ok')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-2xl transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Importing...
                  </>
                ) : csvRows.every(r => r.status === 'ok') ? (
                  'All imported'
                ) : (
                  `Import ${csvRows.filter(r => r.status !== 'ok').length} Employees`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk shift assignment modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4"
          onClick={() => { if (!bulkSaving) setBulkOpen(false); }}>
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Bulk Shift Assignment</h3>
                <p className="text-xs text-gray-700 mt-0.5">{selectedIds.length} employee(s) selected</p>
              </div>
              {!bulkSaving && (
                <button onClick={() => setBulkOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-700" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-gray-700 mb-1.5">Shift Type</label>
                <select
                  value={bulkShiftType}
                  onChange={(e) => {
                    const next = e.target.value as ShiftType;
                    setBulkShiftType(next);
                    applyBulkTemplate(next);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
                >
                  {Object.entries(SHIFT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1.5">Work Start Time</label>
                  <input type="time" value={bulkStart} disabled={bulkShiftType !== 'CUSTOM'} onChange={(e) => setBulkStart(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
                    style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }} />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1.5">Work End Time</label>
                  <input type="time" value={bulkEnd} disabled={bulkShiftType !== 'CUSTOM'} onChange={(e) => setBulkEnd(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
                    style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1.5">Break Schedule</label>
                <div className="space-y-2">
                  {bulkBreaks.map((b, idx) => (
                    <div key={`${b.name}-${idx}`} className="grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={b.name}
                        disabled={bulkShiftType !== 'CUSTOM'}
                        onChange={(e) => {
                          const next = [...bulkBreaks];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setBulkBreaks(next);
                        }}
                        className="px-3 py-2 rounded-xl text-xs focus:outline-none disabled:opacity-60"
                        style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
                      />
                      <input
                        type="time"
                        value={b.start}
                        disabled={bulkShiftType !== 'CUSTOM'}
                        onChange={(e) => {
                          const next = [...bulkBreaks];
                          next[idx] = { ...next[idx], start: e.target.value };
                          setBulkBreaks(next);
                        }}
                        className="px-3 py-2 rounded-xl text-xs focus:outline-none disabled:opacity-60"
                        style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
                      />
                      <input
                        type="time"
                        value={b.end}
                        disabled={bulkShiftType !== 'CUSTOM'}
                        onChange={(e) => {
                          const next = [...bulkBreaks];
                          next[idx] = { ...next[idx], end: e.target.value };
                          setBulkBreaks(next);
                        }}
                        className="px-3 py-2 rounded-xl text-xs focus:outline-none disabled:opacity-60"
                        style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
                      />
                      <input
                        type="number"
                        min={0}
                        value={b.durationMinutes}
                        disabled={bulkShiftType !== 'CUSTOM'}
                        onChange={(e) => {
                          const next = [...bulkBreaks];
                          next[idx] = { ...next[idx], durationMinutes: Number(e.target.value) };
                          setBulkBreaks(next);
                        }}
                        className="px-3 py-2 rounded-xl text-xs focus:outline-none disabled:opacity-60"
                        style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
                      />
                    </div>
                  ))}
                  {bulkShiftType === 'CUSTOM' && (
                    <button
                      onClick={() => setBulkBreaks(p => [...p, { name: 'Break', start: '13:00', end: '13:15', durationMinutes: 15 }])}
                      className="text-xs font-semibold text-orange-600"
                    >
                      + Add Break
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1.5">Week Off</label>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map(day => {
                    const checked = bulkWeekOffs.includes(day);
                    return (
                      <label key={day} className="flex items-center gap-1 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked ? [...bulkWeekOffs, day] : bulkWeekOffs.filter(d => d !== day);
                            setBulkWeekOffs(next);
                          }}
                        />
                        {day.slice(0, 3)}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={saveBulkShift}
                disabled={bulkSaving || selectedIds.length === 0}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-2xl transition disabled:opacity-60"
              >
                {bulkSaving ? 'Applying...' : 'Apply Shift to Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

