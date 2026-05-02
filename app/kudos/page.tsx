'use client';

import React, { useEffect, useState } from 'react';
import EmployeeSidebar from '@/components/employee-sidebar';
import GiveKudoModal from '@/components/GiveKudoModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Trophy } from 'lucide-react';
import { Kudo } from '@/lib/kudos-store';

const TAG_STYLES: Record<string, string> = {
  'Hustle': 'bg-[#fff5f0] text-[#ff6b2b] border-[#ffe0d1]',
  'Customer Love': 'bg-[#fff9e6] text-[#cc9900] border-[#fff2cc]',
  'Team Player': 'bg-[#e6f0ff] text-[#0066ff] border-[#cce0ff]',
  'Above & Beyond': 'bg-[#e6fcf5] text-[#00b386] border-[#c3fae8]',
  'Bug Fixer': 'bg-[#f3f0ff] text-[#7048e8] border-[#e5dbff]',
  'Streak Hero': 'bg-[#fff0f0] text-[#ff4d4d] border-[#ffcccc]',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatShortTime(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  return `${Math.floor(diffInSeconds / 86400)}d`;
}

const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-orange-500', 'bg-yellow-500', 
  'bg-red-500', 'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-cyan-500'
];

export default function KudosPage() {
  const [kudos, setKudos] = useState<Kudo[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchKudos = () => {
    fetch('/api/kudos')
      .then(r => r.json())
      .then(d => {
        if (d.kudos) setKudos(d.kudos);
      })
      .finally(() => setLoading(false));
  };

  const fetchStats = () => {
    fetch('/api/kudos/stats')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});
  };

  const fetchEmployees = () => {
    fetch('/api/kudos/employees')
      .then(r => r.json())
      .then(d => {
        if (d.employees) setEmployees(d.employees);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchKudos();
    fetchEmployees();
    fetchStats();
    const interval = setInterval(() => {
      fetchKudos();
      fetchStats();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#fcfcfc]">
      <EmployeeSidebar />
      
      <main className="md:ml-64 p-6 md:p-12">
        <div className="max-w-2xl mx-auto">
          {/* Header Section */}
          <div className="flex items-end justify-between mb-8 px-2">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Kudos</h1>
                <Badge variant="outline" className="bg-orange-50 text-orange-500 border-orange-100 font-bold uppercase text-[9px] px-2 py-0">Recognition Wall</Badge>
              </div>
              <p className="text-gray-400 text-sm font-medium italic">Public, specific, generous.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button 
                onClick={() => setIsModalOpen(true)}
                className="bg-[#ff9166] hover:bg-[#ff7a45] text-white rounded-2xl px-6 h-12 text-sm font-bold shadow-xl shadow-orange-100 transition-all hover:scale-105 active:scale-95"
              >
                + Give kudo
              </Button>
              {stats?.remaining !== undefined && (
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
                  {stats.remaining} kudos left today
                </span>
              )}
            </div>
          </div>

          {/* Weekly Leaderboard Section */}
          {stats?.leaderboard?.length > 0 && (
            <div className="mb-10 px-2 animate-in fade-in slide-in-from-top-4 duration-700">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center gap-2">
                <Trophy className="w-3 h-3 text-yellow-500" />
                Top Recognized This Week
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {stats.leaderboard.map((entry: any, i: number) => (
                  <Card key={entry.id} className="rounded-[20px] border-gray-100 shadow-sm bg-white overflow-hidden hover:border-orange-100 transition-colors">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="text-2xl w-8 h-8 flex items-center justify-center">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black text-gray-900 truncate leading-none mb-1">{entry.name.split(' ')[0]}</div>
                        <div className="text-[9px] text-orange-500 font-black uppercase tracking-widest">{entry.score} pts</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Kudos Feed */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 px-2">
              Recent Shoutouts
            </h2>
            {loading ? (
              <div className="text-center py-20 text-gray-300 font-medium text-base">Loading recognition wall...</div>
            ) : kudos.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-[32px] bg-white">
                <p className="text-gray-400 font-medium text-sm">No kudos yet. Celebrate your first teammate!</p>
              </div>
            ) : (
              kudos.map((kudo, idx) => (
                <Card key={kudo.id} className="rounded-[24px] border border-gray-100 shadow-sm bg-white overflow-hidden transition-all hover:shadow-md">
                  <CardContent className="p-4 md:p-5">
                    <div className="flex gap-4">
                      {/* Avatar Circle - Sender */}
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm md:text-base ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                        {getInitials(kudo.fromName)}
                      </div>

                      {/* Info Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1">
                            <span className="text-sm font-bold text-gray-900">{kudo.fromName}</span>
                            <Heart className="w-3 h-3 text-orange-400 fill-orange-400" />
                            <span className="text-sm font-bold text-gray-900">{kudo.toName}</span>
                            <Badge 
                              variant="outline" 
                              className={`rounded-full px-2 py-0 text-[8px] font-black uppercase tracking-widest border ${TAG_STYLES[kudo.tag] || 'bg-gray-50 text-gray-500'}`}
                            >
                              {kudo.tag}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">
                            {formatShortTime(kudo.timestamp)}
                          </span>
                        </div>
                        
                        <p className="text-gray-500 text-[11px] md:text-[13px] font-medium leading-relaxed italic mt-0.5">
                          "{kudo.message}"
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>

      <GiveKudoModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          fetchStats(); // Refresh stats after modal close
        }} 
        onSuccess={() => {
          fetchKudos();
          fetchStats();
        }}
        initialEmployees={employees}
      />
    </div>
  );
}
