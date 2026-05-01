'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LeaveRequestForm from './components/LeaveRequestForm';
import TeamCalendar from './components/TeamCalendar';

type LeaveBalance = {
  casual: { total: number; used: number; pending: number };
  sick: { total: number; used: number; pending: number };
  earned: { total: number; used: number; pending: number };
  comp_off: { total: number; used: number; pending: number };
};

type Leave = {
  _id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const LEAVE_LABELS: Record<string, string> = {
  casual: 'Casual',
  sick: 'Sick',
  earned: 'Earned',
  comp_off: 'Comp Off',
  lop: 'LOP',
  other: 'Other',
};

export default function LeavesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'my-leaves' | 'apply' | 'team-calendar'>('my-leaves');
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/leaves${params}`);
      const data = await res.json();
      if (data.ok) setLeaves(data.leaves);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/leaves/balance');
      const data = await res.json();
      if (!data.error) setBalance(data);
    } catch {}
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        await Promise.all([fetchLeaves(), fetchBalance()]);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, fetchLeaves, fetchBalance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const balanceTypes = ['casual', 'sick', 'earned', 'comp_off'] as const;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your leave requests and track balances</p>
        </div>

        {/* Leave Balance Cards */}
        {balance && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {balanceTypes.map((type) => {
              const b = balance[type] || { total: 0, used: 0, pending: 0 };
              const available = b.total - b.used - b.pending;
              return (
                <div key={type} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{LEAVE_LABELS[type]}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{available < 0 ? 0 : available}</p>
                  <p className="text-xs text-gray-400 mt-1">Available of {b.total}</p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-orange-500">{b.pending} pending</span>
                    <span className="text-green-600">{b.used} used</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {([
            { key: 'my-leaves', label: 'My Leaves' },
            { key: 'apply', label: 'Apply Leave' },
            { key: 'team-calendar', label: 'Team Calendar' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* My Leaves Tab */}
        {activeTab === 'my-leaves' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Leave History</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : leaves.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">No leave requests found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {leaves.map((leave) => (
                  <div key={leave._id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm">{LEAVE_LABELS[leave.leaveType] || leave.leaveType}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[leave.status]}`}>
                          {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{leave.startDate} → {leave.endDate} &bull; {leave.totalDays} day{leave.totalDays !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{leave.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Apply Leave Tab */}
        {activeTab === 'apply' && (
          <LeaveRequestForm
            onSuccess={() => {
              fetchLeaves();
              fetchBalance();
              setActiveTab('my-leaves');
            }}
          />
        )}

        {/* Team Calendar Tab */}
        {activeTab === 'team-calendar' && <TeamCalendar />}
      </div>
    </div>
  );
}
