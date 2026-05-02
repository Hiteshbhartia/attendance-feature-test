'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown, AlertCircle, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface GiveKudoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialEmployees?: any[];
}

const KUDO_TAGS = ['Hustle', 'Customer Love', 'Team Player', 'Above & Beyond', 'Bug Fixer', 'Streak Hero'] as const;

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-orange-500', 'bg-yellow-500', 
  'bg-red-500', 'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-cyan-500'
];

export default function GiveKudoModal({ isOpen, onClose, onSuccess, initialEmployees }: GiveKudoModalProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [showError, setShowError] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    toId: '',
    toName: '',
    toPhoto: '',
    tag: '' as any,
    message: '',
  });

  const fetchStats = () => {
    fetch('/api/kudos/stats')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;
    
    fetchStats();

    if (initialEmployees && initialEmployees.length > 0) {
      setEmployees(initialEmployees);
      return;
    }

    const cached = sessionStorage.getItem('gharpayy_employees_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) setEmployees(parsed);
      } catch (e) {}
    }

    setFetchingEmployees(true);
    fetch('/api/kudos/employees')
      .then(r => r.json())
      .then(d => {
        if (d.employees) {
          setEmployees(d.employees);
          try {
            sessionStorage.setItem('gharpayy_employees_cache', JSON.stringify(d.employees));
          } catch (e) {
            console.warn('Session storage quota exceeded');
          }
        }
      })
      .finally(() => setFetchingEmployees(false));
  }, [isOpen, initialEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.toId || !formData.tag || formData.message.trim().length < 5) {
      setShowError(true);
      toast({
        title: "Missing Information",
        description: formData.message.trim().length < 5 
          ? "Please explain WHY they deserve this kudo (min 5 chars)." 
          : "Please select a teammate and a tag.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setShowError(false);
    try {
      const res = await fetch('/api/kudos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.ok) {
        toast({
          title: "Kudo Sent! ❤️",
          description: `You cheered on ${formData.toName}!`,
        });
        onSuccess();
        onClose();
        setFormData({ toId: '', toName: '', toPhoto: '', tag: '', message: '' });
      } else {
        toast({
          title: "Limit Reached",
          description: data.error || "Failed to send kudo",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900 leading-none">Cheer someone on</DialogTitle>
              <p className="text-gray-400 text-xs mt-2 font-medium">Make their week. Be specific.</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* TO SECTION */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">To</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full h-12 justify-between rounded-xl border-gray-100 bg-gray-50 hover:bg-gray-100 px-4 text-sm font-normal text-gray-600 shadow-sm"
                  >
                    {formData.toId ? (
                      <div className="flex items-center gap-2">
                        {formData.toPhoto ? (
                          <img src={formData.toPhoto} className="w-6 h-6 rounded-full object-cover border border-gray-200" alt="" />
                        ) : (
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-orange-500`}>
                            {getInitials(formData.toName)}
                          </div>
                        )}
                        <span className="font-semibold text-gray-900">{formData.toName}</span>
                      </div>
                    ) : (fetchingEmployees && !employees.length) ? "Loading teammates..." : "Search for a teammate"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl shadow-2xl border-gray-100 overflow-hidden bg-white z-[100]" 
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <Command className="rounded-none">
                    <CommandInput placeholder="Type to search..." className="h-12 text-sm border-none focus:ring-0" />
                    <CommandList className="max-h-[280px] overflow-y-auto scrollbar-hide">
                      <CommandEmpty className="py-8 text-center text-xs text-gray-400">No teammate found.</CommandEmpty>
                      <CommandGroup heading="Teammates" className="px-2 pb-2">
                        {employees.map((emp, idx) => (
                          <CommandItem
                            key={emp._id}
                            value={emp.fullName}
                            onSelect={() => {
                              setFormData(prev => ({ 
                                ...prev, 
                                toId: emp._id, 
                                toName: emp.fullName,
                                toPhoto: emp.profilePhoto || ''
                              }));
                              setOpen(false);
                            }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer data-[selected=true]:bg-orange-50 data-[selected=true]:text-orange-700 transition-colors"
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 text-orange-500",
                                formData.toId === emp._id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {emp.profilePhoto ? (
                              <img src={emp.profilePhoto} className="w-8 h-8 rounded-full object-cover border border-gray-100" alt="" />
                            ) : (
                              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                {getInitials(emp.fullName)}
                              </div>
                            )}
                            <span className="text-sm font-semibold">{emp.fullName}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* FOR SECTION */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">For</Label>
              <div className="flex flex-wrap gap-2">
                {KUDO_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, tag }))}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border shadow-sm ${
                      formData.tag === tag 
                      ? 'bg-red-50 text-red-600 border-red-200 ring-2 ring-red-50' 
                      : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* WHY SECTION */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">Why</Label>
              <Textarea 
                placeholder="One sentence. Specific is best."
                value={formData.message}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, message: e.target.value }));
                  if (e.target.value.trim().length >= 5) setShowError(false);
                }}
                className={cn(
                  "min-h-[120px] rounded-2xl border-gray-100 bg-gray-50 focus:bg-white transition-all text-sm resize-none p-4 placeholder:text-gray-300 shadow-inner",
                  showError && formData.message.trim().length < 5 && "border-red-200 bg-red-50"
                )}
              />
              {showError && formData.message.trim().length < 5 && (
                <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1 animate-pulse">
                  <AlertCircle className="w-3 h-3" />
                  Please provide a reason (min 5 characters)
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <Button 
                type="submit" 
                className="w-full h-14 rounded-2xl bg-[#ff9166] hover:bg-[#ff7a45] text-white font-bold text-base shadow-lg shadow-orange-100 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                disabled={loading || (stats?.remaining === 0)}
              >
                {loading ? "Sending..." : stats?.remaining === 0 ? "Daily limit reached" : "Send the kudo"}
              </Button>
              {stats?.remaining !== undefined && (
                <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest">
                  You have {stats.remaining} kudos left today
                </p>
              )}
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
