'use client';
import { useEffect, useState } from 'react';
import EmployeeSidebar from '@/components/employee-sidebar';
import { Heart } from 'lucide-react';

function Ring({ value, label, color, size = 80 }: { value: number; label: string; color: string; size?: number }) {
  const r = (size / 2) - 7; const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth="6"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${(value/100)*circ} ${circ}`} strokeLinecap="round"/>
        </svg>
        <div className="z-10 text-center">
          <div className="text-sm font-bold text-gray-900">{value}%</div>
        </div>
      </div>
      <div className="text-[10px] text-center leading-tight" style={{ color: '#6b7280' }}>{label}</div>
    </div>
  );
}

function Bar({ label, value, color, trend }: { label: string; value: number; color: string; trend?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs" style={{ color: '#4b5563' }}>{label}</span>
        <div className="flex items-center gap-2">
          {trend && <span className="text-[10px]" style={{ color: trend.startsWith('+') ? '#10b981' : '#ef4444' }}>{trend}</span>}
          <span className="text-xs font-bold" style={{ color }}>{value}%</span>
        </div>
      </div>
      <div className="w-full h-1.5 rounded-full" style={{ background: '#f3f4f6' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${value}%`, background: color }}/>
      </div>
    </div>
  );
}

export default function MyPerformance() {
  const [data, setData] = useState<any>(null);
  const [att, setAtt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [kudosScore, setKudosScore] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/attendance/status').then(r => r.json()),
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/kudos/stats').then(r => r.json()),
    ]).then(([attData, taskData, statsData]) => {
      setAtt(attData);
      setData(taskData);
      setKudosScore(statsData.score);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };

  const taskTotal = data?.summary?.total || 0;
  const taskDone = data?.summary?.completed || 0;
  const taskPct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

  const month = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const week = `Week ${Math.ceil(new Date().getDate() / 7)}`;

  const overallScore = Math.round((87 * 0.4) + (taskPct * 0.4) + (91 * 0.2));

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      <EmployeeSidebar />
      <div className="md:ml-64 pb-24 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          <div style={card} className="p-5">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">ARENA OS - Performance Analytics</h1>
            <div className="text-xs" style={{ color: '#6b7280' }}>{month} - {week}</div>
          </div>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl" style={{ background: '#ffffff' }}/>)}
            </div>
          ) : (
            <>
              {/* Overall Score Cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'OVERALL SCORE', value: overallScore, suffix: '%', color: '#f59e0b', sub: `+4% from last week` },
                  { label: 'ATTENDANCE RATE', value: 87, suffix: '%', color: '#6366f1', sub: `18/20 days present` },
                  { label: 'TASK COMPLETION', value: taskPct, suffix: '%', color: '#10b981', sub: `${taskDone}/${taskTotal} tasks done` },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-2xl"
                    style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                    <div className="text-[9px] font-bold tracking-widest mb-2" style={{ color: '#6b7280' }}>{s.label}</div>
                    <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}{s.suffix}</div>
                    <div className="text-[10px] mt-1" style={{ color: '#6b7280' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Kudos Score Integration */}
              <div style={card} className="p-4 bg-gradient-to-r from-orange-50 to-white border-orange-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-200">
                    <Heart className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Kudos Score (This Week)</div>
                    <div className="text-xl font-black text-gray-900">{kudosScore !== null ? `${kudosScore} pts` : 'Loading...'}</div>
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 font-medium max-w-[120px] text-right">
                  Earn points from teammates for your hard work and hustle.
                </div>
              </div>

              {/* KPI Scorecard */}
              <div style={card} className="p-5">
                <h2 className="text-sm font-bold text-gray-900 mb-5">KPI Scorecard</h2>
                <div className="grid grid-cols-3 gap-4 justify-items-center">
                  <Ring value={87} label="Attendance"      color="#10b981"/>
                  <Ring value={taskPct || 72} label="Task Completion" color="#6366f1"/>
                  <Ring value={91} label="SLA Follow-up"  color="#f59e0b"/>
                </div>
                <div className="mt-5 space-y-3 pt-4 border-t" style={{ borderColor: '#f9fafb' }}>
                  <Bar label="On-time arrival"     value={87} color="#10b981" trend="+1%"/>
                  <Bar label="Task completion"     value={taskPct || 72} color="#6366f1" trend="-2%"/>
                  <Bar label="Break discipline"    value={90} color="#f59e0b" trend="+3%"/>
                  <Bar label="Notice read rate"    value={100} color="#a855f7" trend="+0%"/>
                </div>
              </div>

              {/* Today's Status */}
              {att && att.dayStatus !== 'Absent' && (
                <div style={card} className="p-5">
                  <h2 className="text-sm font-bold text-gray-900 mb-3">Today</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Status',       value: att.dayStatus,            color: att.dayStatus === 'Early' ? '#10b981' : att.dayStatus === 'On Time' ? '#818cf8' : '#f59e0b' },
                      { label: 'Work Mode',    value: att.workMode || 'Active', color: '#10b981' },
                      { label: 'Hours Worked', value: att.totalWorkFormatted || '0m', color: '#374151' },
                      { label: 'Break Time',   value: att.totalBreakFormatted || '0m', color: '#f59e0b' },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl" style={{ background: '#f9fafb' }}>
                        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#6b7280' }}>{s.label}</div>
                        <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* My Tasks Summary */}
              {data?.tasks && data.tasks.length > 0 && (
                <div style={card} className="p-5">
                  <h2 className="text-sm font-bold text-gray-900 mb-3">My Tasks This Week</h2>
                  <div className="space-y-2">
                    {data.tasks.slice(0, 5).map((t: any) => (
                      <div key={t._id} className="flex items-center justify-between py-2 border-b last:border-0"
                        style={{ borderColor: '#f9fafb' }}>
                        <span className="text-sm" style={{ color: '#374151' }}>{t.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                          style={{
                            background: t.status === 'completed' ? 'rgba(16,185,129,0.12)' : t.status === 'blocked' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                            color: t.status === 'completed' ? '#10b981' : t.status === 'blocked' ? '#ef4444' : '#818cf8',
                          }}>{t.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}




