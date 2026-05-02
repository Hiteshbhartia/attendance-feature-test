'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Clock, ClipboardList, ClipboardCheck, Bell, TrendingUp, History, LogOut, Settings, Menu, X, Calendar, Heart } from 'lucide-react';
import WorkScheduleModal from '@/components/work-schedule-modal';
import GiveKudoModal from '@/components/GiveKudoModal';
import { getCurrentWeekInfo } from '@/lib/week-utils';

const NAV_ITEMS = [
  { label: 'My Attendance', href: '/home', icon: Clock },
  { label: 'Daily Updates', href: '/tracker', icon: ClipboardList },
  { label: 'Weekly Tracker', href: '/daily-tracker', icon: ClipboardCheck },
  { label: 'My Leaves', href: '/my-leaves', icon: Calendar },
  { label: 'My Tasks', href: '/my-tasks', icon: ClipboardList },
  { label: 'Announcements Hub', href: '/notices', icon: Bell },
  { label: 'Performance Analytics', href: '/my-performance', icon: TrendingUp },
  { label: 'Kudos', href: '/kudos', icon: Heart },
  { label: 'My History', href: '/my-history', icon: History },
  { label: 'Settings', href: '/settings', icon: Settings },
];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function EmployeeSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [noticeCount, setNoticeCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isKudoModalOpen, setIsKudoModalOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.id || d.email) setUser(d);
      })
      .catch(() => {});
    
    fetch('/api/kudos/employees')
      .then(r => r.json())
      .then(d => {
        if (d.employees) setEmployees(d.employees);
      })
      .catch(() => {});
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  return (
    <>
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 z-40 bg-white border-r border-gray-200 overflow-hidden">
        <div className="px-5 py-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm bg-orange-500">A</div>
            <div>
              <div className="text-sm font-bold text-gray-900 leading-tight">Gharpayy</div>
              <div className="text-[11px] text-orange-500 font-semibold">ARENA OS</div>
            </div>
          </div>
          <div className="text-xs text-gray-700 mt-3">Gharpayy - ARENA OS</div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto no-scrollbar">
          <div className="space-y-1">
            {NAV_ITEMS.map(item => {
              const active = isActive(item.href);
              const isNotice = item.href === '/notices';
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition border-l-2"
                  style={{
                    borderLeftColor: active ? '#f97316' : 'transparent',
                    background: active ? '#fff7ed' : 'transparent',
                    color: active ? '#f97316' : '#374151',
                  }}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? '#f97316' : '#6b7280' }} />
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  {isNotice && noticeCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">{noticeCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-3 bg-white pb-8">
          <button
            onClick={() => setIsKudoModalOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition border border-orange-200/50 group"
          >
            <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center border border-orange-100 group-hover:scale-110 transition-transform">
              <Heart className="w-3 h-3 text-orange-500 fill-orange-500" />
            </div>
            <span>Give a kudo</span>
          </button>

          {user && (
            <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              {user.profilePhoto ? (
                <img src={user.profilePhoto} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {initials(user.fullName || user.email)}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-800 truncate">{user.fullName || 'Employee'}</div>
                <div className="text-[11px] text-gray-700 truncate">{user.email || ''}</div>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-600 hover:bg-gray-100 transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <GiveKudoModal 
        isOpen={isKudoModalOpen} 
        onClose={() => setIsKudoModalOpen(false)} 
        onSuccess={() => {}} 
        initialEmployees={employees}
      />

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold bg-orange-500">A</div>
            <div className="text-sm font-semibold text-gray-900">Gharpayy - ARENA OS</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-orange-500 border border-gray-200 rounded-lg px-2.5 py-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg p-2 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[57px] left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => { router.push(item.href); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition text-left ${
                  active ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-500' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="md:hidden h-4" />
      <WorkScheduleModal />
    </>
  );
}


