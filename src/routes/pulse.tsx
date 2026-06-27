import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, Fragment } from "react";
import { useAttendanceState } from "@/hooks/useAttendance";
import { tierOf } from "@/lib/permissions";
import { getRoster } from "@/lib/roster";
import {
  SLOTS,
  type SlotKey,
  type SlotDef,
  type PulseEntry,
  activeSlot,
  complianceFor,
  getEntries,
  orgComplianceToday,
  submitPulse,
  flushPulseSync,
  subscribe,
  todayISO,
} from "@/lib/pulse-store";
import { getEventsFor, todayKey } from "@/lib/attendance-store";
import { dayHealth, subscribeConsole } from "@/lib/console-store";
import { api } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks, isSameDay, isToday, subDays } from "date-fns";
import { Avatar } from "@/components/Avatar";
import { Clock, Send, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, Sparkles, Upload, X, Image as ImageIcon, Filter, Search, SlidersHorizontal, Calendar } from "lucide-react";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/pulse")({
  component: PulsePage,
});

function PulsePage() {
  const { actor, events } = useAttendanceState();
  const isClockedIn = useMemo(() => {
    const today = todayKey();
    return events.some(e => e.employeeId === actor.id && todayKey(e.ts) === today);
  }, [events, actor.id]);
  const tier = tierOf(actor);
  const canSeeAll =
    tier === "leadership" || tier === "hr" || tier === "zone_leader" || tier === "leader";

  // re-render on store changes
  const [v, setV] = useState(0);
  useEffect(() => subscribe(() => setV((x) => x + 1)), []);
  // tick once a minute so the active slot stays current
  useEffect(() => {
    const i = setInterval(() => setV((x) => x + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  const current = activeSlot();
  const mine = complianceFor(actor.id);
  const myEntries = useMemo(
    () => getEntries({ employeeId: actor.id, date: todayISO() }),
    [actor.id, v],
  );

  const [selected, setSelected] = useState<SlotKey>(current?.key ?? "slot1");
  useEffect(() => {
    if (current) setSelected(current.key);
  }, [current?.key]);

  const [viewImages, setViewImages] = useState<string[] | null>(null);

  const tourSteps: any[] = canSeeAll ? [
    {
      popover: {
        title: "Organization Pulses",
        description: "Welcome to the Daily Pulse admin view. Here you can see a live feed of all daily pulses across the organization.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-admin-pulse-search",
      popover: { title: "Search", description: "Search for specific employees, or keywords in their pulse texts.", side: "bottom" }
    },
    {
      element: "#tour-admin-pulse-daterange",
      popover: { title: "Date Range", description: "View pulses from yesterday, the last week, or any custom date range.", side: "bottom" }
    },
    {
      element: "#tour-admin-pulse-filters",
      popover: { title: "Advanced Filters", description: "Filter by role, team, slot, status, or even specific metrics like call volume.", side: "bottom" }
    },
    {
      element: "#tour-admin-pulse-export",
      popover: { title: "Export to Excel", description: "Copy the current view to your clipboard, perfectly formatted to paste into Excel.", side: "bottom" }
    }
  ] : [
    {
      popover: {
        title: "Daily Pulse",
        description: "Welcome to your Daily Pulse. This is where you log your daily progress, blockers, and proof of work.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-pulse-slots",
      popover: { title: "Pulse Windows", description: "Your daily pulses are broken into windows. You can only submit a pulse when its window is open.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-pulse-submit",
      popover: { title: "Submit Pulse", description: "Type your update, fill in your metrics, and add any screenshots to prove your work.", side: "right", align: "start" }
    },
    {
      element: "#tour-pulse-history",
      popover: { title: "My Day", description: "Review what you've submitted today and see if you were on time or late.", side: "right", align: "start" }
    },
    {
      element: "#tour-pulse-compliance",
      popover: { title: "Compliance Score", description: "Keep your daily compliance at 100% to maintain a perfect score.", side: "left", align: "start" }
    }
  ];

  usePageTour(canSeeAll ? "admin_pulse_tour" : "pulse_tour", tourSteps);

  if (canSeeAll) {
    return <AdminPulseView />;
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-6">
      {/* Hero */}
      <header className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary mb-2">
              Gharpayy · Daily Pulse
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Three pulses. One brief. Every day.
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Submit each slot inside its window. Honesty over polish — your manager sees this in
              real time.
            </p>
          </div>
          {current ? (
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-right">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Open now
              </div>
              <div className="font-display text-lg font-semibold">{current.label}</div>
              <div className="font-mono text-xs text-muted-foreground">{current.window}</div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-right">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                No slot open
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Between windows — catch your breath.
              </div>
            </div>
          )}
        </div>

        {/* Today strip */}
        <div id="tour-pulse-slots" className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6">
          {SLOTS.map((s) => {
            const done = mine.done.includes(s.key);
            const isActive = current?.key === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSelected(s.key)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  selected === s.key
                    ? "border-primary bg-primary/10"
                    : done
                      ? "border-success/30 bg-success/5 hover:bg-success/10"
                      : isActive
                        ? "border-primary/40 bg-card hover:bg-primary/5"
                        : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.key === "eod" ? "EOD" : s.key.replace("slot", "Slot ")}
                  </div>
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : isActive ? (
                    <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />
                  ) : (
                    <span className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="font-display text-sm font-semibold mt-1 truncate">
                  {s.label.split(" · ")[1] || s.label}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{s.window}</div>
              </button>
            );
          })}
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Submission */}
        <section className="lg:col-span-2">
          <div id="tour-pulse-submit">
            <SubmitCard slot={SLOTS.find((s) => s.key === selected)!} employeeId={actor.id} />
          </div>

          {/* My day */}
          <div id="tour-pulse-history" className="mt-6 rounded-2xl border border-border bg-card">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-display font-semibold">
                  My day ·{" "}
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {myEntries.length} of 4 submitted
                </div>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="divide-y divide-border">
              {SLOTS.map((s) => {
                const entry = myEntries.find((e) => e.slot === s.key);
                return (
                  <div key={s.key} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {s.label} · {s.window}
                      </div>
                      {entry ? (
                        <span
                          className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            entry.onTime
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-warning/30 bg-warning/10 text-warning"
                          }`}
                        >
                          {entry.onTime ? "On time" : "Late"}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          Pending
                        </span>
                      )}
                    </div>
                    {entry ? (
                      <div className="text-sm text-foreground/90 whitespace-pre-wrap">
                        {entry.text}
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelected(s.key)}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Write it now <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                    {entry && (entry.calls || entry.tours || entry.closures) ? (
                      <div className="flex gap-3 mt-2 text-xs font-mono text-muted-foreground">
                        {entry.calls != null && <span>{entry.calls} calls</span>}
                        {entry.tours != null && <span>{entry.tours} tours</span>}
                        {entry.closures != null && <span>{entry.closures} closures</span>}
                      </div>
                    ) : null}
                    {entry?.blockers && (
                      <div className="mt-2 text-xs rounded-md border border-destructive/20 bg-destructive/5 text-destructive px-2 py-1 inline-flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {entry.blockers}
                      </div>
                    )}
                    {entry?.mediaUrls && entry.mediaUrls.length > 0 && (
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {entry.mediaUrls.map((url, idx) => (
                          <img 
                            key={idx} 
                            src={url} 
                            className="h-12 w-12 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setViewImages(entry.mediaUrls || null)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {myEntries.length === 0 && !isClockedIn && (
            <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 flex gap-3 shadow-sm">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-destructive">You are currently marked as Absent</h3>
                <p className="text-sm text-destructive/90 mt-1">
                  You have not clocked in or submitted any pulse updates today. Please log your progress to correct your attendance status.
                </p>
              </div>
            </div>
          )}
          {myEntries.length === 0 && isClockedIn && (
            <div className="mt-6 rounded-2xl border border-warning/30 bg-warning/10 p-5 flex gap-3 shadow-sm">
              <Clock className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-warning-foreground">Missing Pulses</h3>
                <p className="text-sm text-warning-foreground/90 mt-1">
                  You have clocked in but haven't submitted any pulse updates today. Please log your progress.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Right rail */}
        <aside className="space-y-6">
          <div id="tour-pulse-compliance">
            <MyComplianceCard mine={mine} />
          </div>
          {canSeeAll && <OrgComplianceCard />}
        </aside>
      </div>

      {viewImages && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-start p-4 md:p-10 backdrop-blur-sm cursor-pointer overflow-y-auto"
          onClick={() => setViewImages(null)}
        >
          <div className="relative max-w-5xl w-full flex flex-col items-center gap-8 py-10 my-auto" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setViewImages(null)}
              className="sticky top-4 self-end md:-mr-12 bg-secondary text-foreground rounded-full p-2 hover:bg-destructive hover:text-white transition-colors z-10 shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
            {viewImages.map((url, idx) => (
              <img key={idx} src={url} alt={`Proof of Work ${idx+1}`} className="max-w-full max-h-[85vh] rounded-md shadow-2xl object-contain bg-black" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmitCard({ slot, employeeId }: { slot: SlotDef; employeeId: string }) {
  const existing = getEntries({ employeeId, date: todayISO(), slot: slot.key })[0];
  const [text, setText] = useState(existing?.text || "");
  const [calls, setCalls] = useState<string>(existing?.calls?.toString() || "");
  const [tours, setTours] = useState<string>(existing?.tours?.toString() || "");
  const [closures, setClosures] = useState<string>(existing?.closures?.toString() || "");
  const [blockers, setBlockers] = useState(existing?.blockers || "");
  const [mediaUrls, setMediaUrls] = useState<string[]>(existing?.mediaUrls || []);
  const [saved, setSaved] = useState(false);
  const [polishing, setPolishing] = useState(false);

  const handleAIPolish = async () => {
    if (slot.key !== "eod" && !text.trim()) return;
    setPolishing(true);
    try {
      let mode = "polish_pulse";
      let contextStr = text;
      
      if (slot.key === "eod") {
        mode = "generate_eod";
        const earlierEntries = getEntries({ employeeId, date: todayISO() }).filter(e => e.slot !== "eod");
        contextStr = earlierEntries.map(e => `[${e.slot}]: ${e.text}`).join("\n\n");
      }

      const res = await api.post<{ text: string }>("/ai/template", {
        mode,
        context: contextStr
      });
      if (res && res.text) {
        setText(res.text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPolishing(false);
    }
  };

  useEffect(() => {
    const e = getEntries({ employeeId, date: todayISO(), slot: slot.key })[0];
    setText(e?.text || "");
    setCalls(e?.calls?.toString() || "");
    setTours(e?.tours?.toString() || "");
    setClosures(e?.closures?.toString() || "");
    setBlockers(e?.blockers || "");
    setMediaUrls(e?.mediaUrls || []);
    setSaved(false);
  }, [slot.key, employeeId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const promises = files.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (ev.target?.result) {
              resolve(ev.target.result as string);
            }
          };
          reader.readAsDataURL(file);
        });
      });
      Promise.all(promises).then(urls => {
        setMediaUrls(prev => [...prev, ...urls]);
      });
    }
  }

  function submit() {
    if (!text.trim()) return;
    submitPulse({
      employeeId,
      slot: slot.key,
      text,
      calls: calls ? Number(calls) : undefined,
      tours: tours ? Number(tours) : undefined,
      closures: closures ? Number(closures) : undefined,
      blockers,
      mediaUrls,
    });
    // Immediately flush to MongoDB so data persists across refresh
    void flushPulseSync();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-card to-primary/5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
          {slot.window}
        </div>
        <div className="font-display text-xl font-semibold mt-0.5">{slot.label}</div>
        <div className="text-sm text-muted-foreground mt-1">{slot.prompt}</div>
      </div>
      <div className="p-5 space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Type it the way you'd say it on a call. No fluff."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        <div className="flex justify-end mt-[-8px]">
          <button
            onClick={handleAIPolish}
            disabled={(slot.key !== "eod" && !text.trim()) || polishing}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-600 hover:bg-purple-500 hover:text-white transition-colors disabled:opacity-50 font-medium"
          >
            <Sparkles className="h-3 w-3" />
            {polishing ? (slot.key === "eod" ? "Generating..." : "Polishing...") : (slot.key === "eod" ? "Auto-fill EOD" : "AI Polish")}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumberField label="Calls" value={calls} onChange={setCalls} />
          <NumberField label="Tours" value={tours} onChange={setTours} />
          <NumberField label="Closures" value={closures} onChange={setClosures} />
        </div>
        <input
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
          placeholder="Anything blocked? (optional)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Proof of Work (optional)</label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-xs bg-secondary/50 hover:bg-secondary transition-colors">
              <Upload className="h-3.5 w-3.5" /> Upload Screenshot(s)
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
            </label>
            {mediaUrls.length > 0 && <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {mediaUrls.length} uploaded</span>}
          </div>
          {mediaUrls.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {mediaUrls.map((url, idx) => (
                <div key={idx} className="relative inline-block">
                  <img src={url} className="h-16 w-16 object-cover rounded border border-border" />
                  <button 
                    onClick={() => setMediaUrls(prev => prev.filter((_, i) => i !== idx))} 
                    className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-0.5 hover:bg-destructive hover:text-white transition-colors"
                  >
                    <X className="h-3 w-3"/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            {existing
              ? `Last saved · ${new Date(existing.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : "Not submitted yet"}
          </div>
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-3.5 w-3.5" />{" "}
            {saved ? "Saved" : existing ? "Update" : "Submit pulse"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const num = parseInt(value || "0", 10);
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      <div className="flex items-center gap-2 w-full min-w-0">
        <button
          onClick={() => onChange(String(Math.max(0, num - 1)))}
          className="h-10 w-10 flex-shrink-0 rounded-xl border border-border hover:bg-secondary text-lg leading-none"
          aria-label={`decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="h-10 flex-1 min-w-0 text-center text-lg font-semibold bg-background border border-border rounded-xl px-2"
        />
        <button
          onClick={() => onChange(String(num + 1))}
          className="h-10 w-10 flex-shrink-0 rounded-xl border border-border hover:bg-secondary text-lg leading-none"
          aria-label={`increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function MyComplianceCard({ mine }: { mine: { done: SlotKey[]; missing: SlotKey[] } }) {
  const rate = Math.round((mine.done.length / SLOTS.length) * 100);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-display font-semibold">My compliance</div>
      <div className="text-xs text-muted-foreground">Today's submission rate</div>
      <div className="mt-3 flex items-end gap-2">
        <div className="font-display text-4xl font-semibold tabular-nums">
          {rate}
          <span className="text-xl text-muted-foreground">%</span>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          {mine.done.length} of {SLOTS.length}
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
        <div
          className="h-full bg-gradient-to-r from-primary to-warning transition-all"
          style={{ width: `${rate}%` }}
        />
      </div>
    </div>
  );
}

function OrgComplianceCard() {
  const rows = orgComplianceToday();
  const avg = Math.round(rows.reduce((a, r) => a + r.rate, 0) / Math.max(rows.length, 1));
  const lagging = rows.filter((r) => r.rate < 100).slice(0, 6);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display font-semibold">Org pulse</div>
            <div className="text-xs text-muted-foreground">Live · today</div>
          </div>
          <div className="font-display text-2xl font-semibold tabular-nums">
            {avg}
            <span className="text-base text-muted-foreground">%</span>
          </div>
        </div>
      </div>
      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {lagging.length === 0 ? (
          <div className="p-5 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
            Everyone is on track.
          </div>
        ) : (
          lagging.map((r) => (
            <div key={r.employeeId} className="px-5 py-3 flex items-center gap-3">
              <Avatar id={r.employeeId} size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                  {r.role} · {r.team}
                </div>
              </div>
              <div
                className={`font-mono text-xs tabular-nums ${r.rate < 50 ? "text-destructive" : r.rate < 80 ? "text-warning" : "text-foreground"}`}
              >
                {r.rate}%
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Helper: get ISO date string from a Date object (matches todayISO format)
function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Helper: get the Mon–Sun days for the week containing `anchor`
function getWeekDays(anchor: Date): Date[] {
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 }); // Monday
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function AdminPulseView({ isEmbedded }: { isEmbedded?: boolean }) {
  const { events: attendanceEvents } = useAttendanceState();
  const [v, setV] = useState(0);
  const [copied, setCopied] = useState(false);
  const [viewImages, setViewImages] = useState<string[] | null>(null);
  const [isExternalView, setIsExternalView] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dateRangeOption, setDateRangeOption] = useState<string>("today");
  const [customStart, setCustomStart] = useState<string>(todayISO());
  const [customEnd, setCustomEnd] = useState<string>(todayISO());

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [slotFilter, setSlotFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "onTime" | "late" | "pending">("all");
  const [callsFilter, setCallsFilter] = useState<string>("all");
  const [toursFilter, setToursFilter] = useState<string>("all");
  const [closuresFilter, setClosuresFilter] = useState<string>("all");
  const [blockersFilter, setBlockersFilter] = useState<"all" | "hasBlockers" | "noBlockers">("all");
  const [mediaFilter, setMediaFilter] = useState<string>("all");
  const [nameFilter, setNameFilter] = useState<string>("all");

  const teams = useMemo(() => Array.from(new Set(getRoster().map((e) => e.team).filter(Boolean))), [v]);
  const roles = useMemo(() => Array.from(new Set(getRoster().map((e) => e.role).filter(Boolean))), [v]);
  const names = useMemo(() => Array.from(new Set(getRoster().map((e) => e.name).filter(Boolean))).sort(), [v]);

  const { startIso, endIso, isSingleDay } = useMemo(() => {
    const today = new Date();
    if (dateRangeOption === "today") return { startIso: todayISO(), endIso: todayISO(), isSingleDay: true };
    if (dateRangeOption === "yesterday") {
      const y = subDays(today, 1);
      return { startIso: dateToISO(y), endIso: dateToISO(y), isSingleDay: true };
    }
    if (dateRangeOption === "7days") return { startIso: dateToISO(subDays(today, 6)), endIso: todayISO(), isSingleDay: false };
    if (dateRangeOption === "14days") return { startIso: dateToISO(subDays(today, 13)), endIso: todayISO(), isSingleDay: false };
    if (dateRangeOption === "30days") return { startIso: dateToISO(subDays(today, 29)), endIso: todayISO(), isSingleDay: false };
    if (dateRangeOption === "custom") {
      const s = customStart || todayISO();
      const e = customEnd || todayISO();
      return { startIso: s, endIso: e, isSingleDay: s === e };
    }
    return { startIso: todayISO(), endIso: todayISO(), isSingleDay: true };
  }, [dateRangeOption, customStart, customEnd]);

  const dateRangeLabel = useMemo(() => {
    if (isSingleDay) return format(new Date(startIso + "T12:00:00"), "d MMM yyyy");
    return `${format(new Date(startIso + "T12:00:00"), "d MMM")} – ${format(new Date(endIso + "T12:00:00"), "d MMM yyyy")}`;
  }, [startIso, endIso, isSingleDay]);

  useEffect(() => {
    const unsubPulse = subscribe(() => setV((x) => x + 1));
    const unsubConsole = subscribeConsole(() => setV((x) => x + 1));
    return () => {
      unsubPulse();
      unsubConsole();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewMediaId = params.get("viewMedia");
    if (viewMediaId) {
      const allEntries = getEntries({});
      const entry = allEntries.find((e) => e.id === viewMediaId);
      if (entry && entry.mediaUrls && entry.mediaUrls.length > 0) {
        setViewImages(entry.mediaUrls);
        setIsExternalView(true);
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const closeViewer = () => {
    setViewImages(null);
    if (isExternalView) {
      window.close();
    }
  };

  const entries = useMemo(() => {
    const allEntries = getEntries({});
    return allEntries.filter(e => e.date >= startIso && e.date <= endIso);
  }, [v, startIso, endIso]);

  const { filteredEntries: groupedEntries, counts } = useMemo(() => {
    const groups: Record<string, typeof entries> = {};
    const roster = getRoster();
    
    for (const emp of roster) {
      const eTier = tierOf(emp);
      if (eTier === "leadership" || eTier === "hr" || eTier === "zone_leader" || eTier === "leader") continue;
      groups[emp.id] = [];
    }

    for (const e of entries) {
      if (!groups[e.employeeId]) groups[e.employeeId] = [];
      groups[e.employeeId].push(e);
    }
    
    const slotOrder: Record<string, number> = { slot1: 1, slot2: 2, slot3: 3, eod: 4 };
    Object.values(groups).forEach(g => g.sort((a,b) => (slotOrder[a.slot] || 99) - (slotOrder[b.slot] || 99)));
    
    const rosterMap = new Map(roster.map(r => [r.id, r]));

    let result = Object.keys(groups).map(empId => {
      const empEntries = groups[empId];
      const linked = rosterMap.get(empId);
      const empName = empEntries.length > 0 ? empEntries[0].employeeName : (linked ? linked.name : empId);
      const role = empEntries.length > 0 ? empEntries[0].role : (linked ? linked.role : "Unknown");
      const team = empEntries.length > 0 ? empEntries[0].team : (linked ? linked.team || "HQ" : "Unknown");

      if (isSingleDay) {
        const eodEntry = empEntries.find(e => e.slot === "eod");
        const regularEntries = empEntries.filter(e => e.slot !== "eod");
        return {
          empId,
          empName,
          role,
          team,
          eodEntry,
          regularEntries: (regularEntries.length > 0 ? regularEntries : [null]) as (PulseEntry | null)[]
        };
      } else {
        return {
          empId,
          empName,
          role,
          team,
          eodEntry: undefined,
          regularEntries: empEntries as (PulseEntry | null)[]
        };
      }
    });

    if (statusFilter === "all") {
      result = result.filter(g => g.regularEntries.some(e => e !== null) || g.eodEntry);
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter((g) => 
        g.empName.toLowerCase().includes(q) || 
        g.regularEntries.some(e => e && e.text.toLowerCase().includes(q)) ||
        (g.eodEntry && g.eodEntry.text.toLowerCase().includes(q))
      );
    }

    if (nameFilter !== "all") {
      result = result.filter((g) => g.empName === nameFilter);
    }

    if (teamFilter !== "all") {
      result = result.filter((g) => g.team === teamFilter);
    }

    if (roleFilter !== "all") {
      result = result.filter((g) => g.role === roleFilter);
    }

    if (slotFilter !== "all") {
      result = result.map(g => {
        if (slotFilter === "eod") {
          return { 
            ...g, 
            regularEntries: g.regularEntries.filter(e => e && e.slot === "eod"),
            eodEntry: g.eodEntry
          };
        } else {
          return { 
            ...g, 
            regularEntries: g.regularEntries.filter(e => e && e.slot === slotFilter), 
            eodEntry: undefined 
          };
        }
      }).filter(g => g.regularEntries.length > 0 || g.eodEntry);
    }

    if (statusFilter !== "all") {
      result = result.map(g => {
        if (statusFilter === "late") {
          return {
            ...g,
            regularEntries: g.regularEntries.filter(e => e && !e.onTime),
            eodEntry: (g.eodEntry && !g.eodEntry.onTime) ? g.eodEntry : undefined
          };
        } else if (statusFilter === "pending") {
          const isTodayDate = startIso === todayISO() && isSingleDay;
          const currentMins = new Date().getHours() * 60 + new Date().getMinutes();
          
          const pendingSlots = SLOTS.filter(slot => {
            const isExpected = !isTodayDate || currentMins >= slot.startMin;
            if (!isExpected) return false;
            if (slot.key === "eod") return !g.eodEntry;
            return !g.regularEntries.some(e => e && e.slot === slot.key);
          });

          if (pendingSlots.length > 0) {
            const fakeEntries = pendingSlots.filter(s => s.key !== "eod").map(s => ({
              id: `pending-${g.empId}-${s.key}`,
              employeeId: g.empId,
              employeeName: g.empName,
              role: g.role,
              team: g.team,
              slot: s.key,
              date: startIso,
              submittedAt: "",
              onTime: false,
              isPending: true,
              text: "—",
            } as any));

            const pendingEod = pendingSlots.some(s => s.key === "eod") ? {
                 id: `pending-eod-${g.empId}`,
                 slot: "eod",
                 submittedAt: "",
                 onTime: false,
                 isPending: true,
                 text: "—"
            } as any : undefined;

            return {
              ...g,
              regularEntries: fakeEntries.length > 0 ? fakeEntries : [null],
              eodEntry: pendingEod
            };
          }
          return null;
        } else {
          return {
            ...g,
            regularEntries: g.regularEntries.filter(e => e && e.onTime),
            eodEntry: (g.eodEntry && g.eodEntry.onTime) ? g.eodEntry : undefined
          };
        }
      }).filter(Boolean) as typeof result;
      if (statusFilter !== "pending") {
        result = result.filter(g => g.regularEntries.some(e => e !== null) || g.eodEntry);
      }
    }

    const counts = {
      highCalls: 0, medCalls: 0, lowCalls: 0, noCalls: 0,
      multipleTours: 0, singleTour: 0, noTours: 0,
      multipleClosures: 0, singleClosure: 0, noClosures: 0,
      hasBlockers: 0, noBlockers: 0,
      hasMedia: 0, noMedia: 0,
    };

    for (const g of result) {
      if (g.regularEntries.some(e => e && (e.calls || 0) >= 10)) counts.highCalls++;
      if (g.regularEntries.some(e => e && (e.calls || 0) >= 5 && (e.calls || 0) <= 9)) counts.medCalls++;
      if (g.regularEntries.some(e => e && (e.calls || 0) >= 1 && (e.calls || 0) <= 4)) counts.lowCalls++;
      if (g.regularEntries.some(e => e && (e.calls || 0) === 0)) counts.noCalls++;

      if (g.regularEntries.some(e => e && (e.tours || 0) >= 2)) counts.multipleTours++;
      if (g.regularEntries.some(e => e && (e.tours || 0) === 1)) counts.singleTour++;
      if (g.regularEntries.some(e => e && (e.tours || 0) === 0)) counts.noTours++;

      if (g.regularEntries.some(e => e && (e.closures || 0) >= 2)) counts.multipleClosures++;
      if (g.regularEntries.some(e => e && (e.closures || 0) === 1)) counts.singleClosure++;
      if (g.regularEntries.some(e => e && (e.closures || 0) === 0)) counts.noClosures++;

      if (g.regularEntries.some(e => e && !!e.blockers) || !!g.eodEntry?.blockers) counts.hasBlockers++;
      if (g.regularEntries.some(e => e && !e.blockers) || (g.eodEntry && !g.eodEntry.blockers)) counts.noBlockers++;

      if (g.regularEntries.some(e => e && e.mediaUrls && e.mediaUrls.length > 0) || (g.eodEntry && g.eodEntry.mediaUrls && g.eodEntry.mediaUrls.length > 0)) counts.hasMedia++;
      if (g.regularEntries.some(e => e && (!e.mediaUrls || e.mediaUrls.length === 0)) || (g.eodEntry && (!g.eodEntry.mediaUrls || g.eodEntry.mediaUrls.length === 0))) counts.noMedia++;
    }

    if (callsFilter === "highVolume") {
      result = result.map(g => ({ ...g, regularEntries: g.regularEntries.filter(e => e && (e.calls || 0) >= 10) })).filter(g => g.regularEntries.length > 0);
    } else if (callsFilter === "mediumVolume") {
      result = result.map(g => ({ ...g, regularEntries: g.regularEntries.filter(e => e && (e.calls || 0) >= 5 && (e.calls || 0) <= 9) })).filter(g => g.regularEntries.length > 0);
    } else if (callsFilter === "lowVolume") {
      result = result.map(g => ({ ...g, regularEntries: g.regularEntries.filter(e => e && (e.calls || 0) >= 1 && (e.calls || 0) <= 4) })).filter(g => g.regularEntries.length > 0);
    } else if (callsFilter === "noCalls") {
      result = result.map(g => ({ ...g, regularEntries: g.regularEntries.filter(e => e && (e.calls || 0) === 0) })).filter(g => g.regularEntries.length > 0);
    }

    if (toursFilter === "multipleTours") {
      result = result.map(g => ({ ...g, regularEntries: g.regularEntries.filter(e => e && (e.tours || 0) >= 2) })).filter(g => g.regularEntries.length > 0);
    } else if (toursFilter === "singleTour") {
      result = result.map(g => ({ ...g, regularEntries: g.regularEntries.filter(e => e && (e.tours || 0) === 1) })).filter(g => g.regularEntries.length > 0);
    } else if (toursFilter === "noTours") {
      result = result.map(g => ({ ...g, regularEntries: g.regularEntries.filter(e => e && (e.tours || 0) === 0) })).filter(g => g.regularEntries.length > 0);
    }

    if (closuresFilter === "multipleClosures") {
      result = result.map(g => ({ ...g, regularEntries: g.regularEntries.filter(e => e && (e.closures || 0) >= 2) })).filter(g => g.regularEntries.length > 0);
    } else if (closuresFilter === "singleClosure") {
      result = result.map(g => ({ ...g, regularEntries: g.regularEntries.filter(e => e && (e.closures || 0) === 1) })).filter(g => g.regularEntries.length > 0);
    } else if (closuresFilter === "noClosures") {
      result = result.map(g => ({ ...g, regularEntries: g.regularEntries.filter(e => e && (e.closures || 0) === 0) })).filter(g => g.regularEntries.length > 0);
    }

    if (mediaFilter === "hasMedia") {
      result = result.map(g => ({
        ...g,
        regularEntries: g.regularEntries.filter(e => e && e.mediaUrls && e.mediaUrls.length > 0),
        eodEntry: (g.eodEntry && g.eodEntry.mediaUrls && g.eodEntry.mediaUrls.length > 0) ? g.eodEntry : undefined
      })).filter(g => g.regularEntries.length > 0 || g.eodEntry);
    } else if (mediaFilter === "noMedia") {
      result = result.map(g => ({
        ...g,
        regularEntries: g.regularEntries.filter(e => e && (!e.mediaUrls || e.mediaUrls.length === 0)),
        eodEntry: (g.eodEntry && (!g.eodEntry.mediaUrls || g.eodEntry.mediaUrls.length === 0)) ? g.eodEntry : undefined
      })).filter(g => g.regularEntries.length > 0 || g.eodEntry);
    }

    if (blockersFilter === "hasBlockers") {
      result = result.map(g => ({
        ...g,
        regularEntries: g.regularEntries.filter(e => e && !!e.blockers),
        eodEntry: (g.eodEntry && !!g.eodEntry.blockers) ? g.eodEntry : undefined
      })).filter(g => g.regularEntries.length > 0 || g.eodEntry);
    } else if (blockersFilter === "noBlockers") {
      result = result.map(g => ({
        ...g,
        regularEntries: g.regularEntries.filter(e => e && !e.blockers),
        eodEntry: (g.eodEntry && !g.eodEntry.blockers) ? g.eodEntry : undefined
      })).filter(g => g.regularEntries.length > 0 || g.eodEntry);
    }

    return { filteredEntries: result, counts };
  }, [entries, teamFilter, roleFilter, slotFilter, statusFilter, callsFilter, toursFilter, closuresFilter, blockersFilter, mediaFilter, searchQuery, nameFilter]);

  const { absentEmployees, missingPulseEmployees } = useMemo(() => {
    const roster = getRoster();
    const submittedIds = new Set(groupedEntries.map(g => g.empId));
    
    const absent: typeof roster = [];
    const missing: typeof roster = [];
    
    const today = todayKey();
    
    roster.forEach(emp => {
      const tier = tierOf(emp);
      // Exclude Admin, HR, and Managers
      if (tier === "leadership" || tier === "hr" || tier === "zone_leader" || tier === "leader") return;
      
      if (!submittedIds.has(emp.id)) {
        const hasAttendance = attendanceEvents.some(e => e.employeeId === emp.id && todayKey(e.ts) === today);
        if (hasAttendance) {
          missing.push(emp);
        } else {
          absent.push(emp);
        }
      }
    });
    
    return { absentEmployees: absent, missingPulseEmployees: missing };
  }, [groupedEntries, attendanceEvents]);

  function copyToClipboard() {
    const headers = [
      "Name",
      "Role",
      "Team",
      "Slot",
      "Time",
      "Status",
      "Calls",
      "Tours",
      "Closures",
      "Blockers",
      "Pulse Text",
      "Proof of Work",
      "EOD Time",
      "EOD Status",
      "EOD Brief",
      "EOD Blockers"
    ];

    const rows: string[][] = [];
    let bodyHtml = "";

    groupedEntries.forEach((group) => {
      const eodTime = group.eodEntry ? (group.eodEntry.isPending ? "—" : new Date(group.eodEntry.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })) : "";
      const eodStatus = group.eodEntry ? (group.eodEntry.isPending ? "Pending" : (group.eodEntry.onTime ? "On Time" : "Late")) : "Pending";
      const eodText = group.eodEntry ? group.eodEntry.text.replace(/\n/g, " ") : "";
      const eodBlockers = group.eodEntry?.blockers ? group.eodEntry.blockers.replace(/\n/g, " ") : "";
      
      const rowCount = group.regularEntries.length;

      group.regularEntries.forEach((e, idx) => {
        // --- TSV Fallback ---
        const name = group.empName;
        const role = group.role;
        const team = group.team;
        const outEodTime = idx === 0 ? eodTime : "";
        const outEodStatus = idx === 0 ? eodStatus : "";
        const outEodText = idx === 0 ? eodText : "";
        const outEodBlockers = idx === 0 ? eodBlockers : "";

        if (e) {
          let slotLabel: string = e.slot;
          const slotObj = SLOTS.find((s) => s.key === e.slot);
          if (slotObj) {
            const parts = slotObj.label.split(" · ");
            slotLabel = parts.length > 1 ? `${parts[0]} (${parts[1]})` : slotObj.label;
          }
          
          const health = dayHealth(group.empId);
          
          rows.push([
            name, role, team,
            slotLabel,
            e.isPending ? "—" : new Date(e.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            e.isPending ? "Pending" : (e.onTime ? "On Time" : "Late"),
            e.calls?.toString() || "", e.tours?.toString() || "", e.closures?.toString() || "",
            e.blockers?.replace(/\n/g, " ") || "", e.text.replace(/\n/g, " "),
            e.mediaUrls?.length ? `[${e.mediaUrls.length} Image(s) Uploaded]` : "",
            outEodTime, outEodStatus, outEodText, outEodBlockers
          ]);
        } else {
          rows.push([name, role, team, "No intraday slots", "", "", "", "", "", "", "", "", outEodTime, outEodStatus, outEodText, outEodBlockers]);
        }

        // --- HTML Table Generation with Styling and Rowspans ---
        let htmlRow = `<tr>`;
        const cellStyle = `border: 1px solid #d1d5db; padding: 8px; vertical-align: top;`;
        const textStyle = `border: 1px solid #d1d5db; padding: 8px; vertical-align: top; width: 300px; white-space: pre-wrap; word-wrap: break-word;`;
        const eodStyle = `border: 1px solid #d1d5db; border-left: 2px solid #9ca3af; padding: 8px; vertical-align: top; background-color: #f8fafc;`;
        const eodTextStyle = `border: 1px solid #d1d5db; border-left: 2px solid #9ca3af; padding: 8px; vertical-align: top; background-color: #f8fafc; width: 300px; white-space: pre-wrap; word-wrap: break-word;`;
        
        htmlRow += `<td style="${cellStyle} font-weight: bold; background-color: #ffffff;">${group.empName}</td>`;
        htmlRow += `<td style="${cellStyle} background-color: #ffffff;">${group.role}</td>`;
        htmlRow += `<td style="${cellStyle} background-color: #ffffff;">${group.team}</td>`;

        if (e) {
          let slotLabel: string = e.slot;
          const slotObj = SLOTS.find((s) => s.key === e.slot);
          if (slotObj) {
            const parts = slotObj.label.split(" · ");
            slotLabel = parts.length > 1 ? `${parts[0]} (${parts[1]})` : slotObj.label;
          }
          const time = e.isPending ? "—" : new Date(e.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
          const statusColor = e.isPending ? '#f59e0b' : (e.onTime ? '#16a34a' : '#ea580c');
          htmlRow += `<td style="${cellStyle} white-space: nowrap; width: 250px; min-width: 250px;">${slotLabel}</td>`;
          htmlRow += `<td style="${cellStyle}">${time}</td>`;
          htmlRow += `<td style="${cellStyle} color: ${statusColor}; font-weight: bold;">${e.isPending ? "Pending" : (e.onTime ? "On Time" : "Late")}</td>`;
          htmlRow += `<td style="${cellStyle}">${e.calls?.toString() || ""}</td>`;
          htmlRow += `<td style="${cellStyle}">${e.tours?.toString() || ""}</td>`;
          htmlRow += `<td style="${cellStyle}">${e.closures?.toString() || ""}</td>`;
          htmlRow += `<td style="${cellStyle}">${e.blockers?.replace(/\n/g, " ") || ""}</td>`;
          htmlRow += `<td style="${textStyle}">${e.text}</td>`;
          const origin = window.location.origin;
          const path = window.location.pathname;
          const mediaLinks = e.mediaUrls?.length ? `<a href="${origin}${path}?viewMedia=${e.id}" target="_blank">View ${e.mediaUrls.length} Image(s)</a>` : "";
          htmlRow += `<td style="${cellStyle}">${mediaLinks}</td>`;
        } else {
          htmlRow += `<td colspan="9" style="${cellStyle} color: #6b7280; font-style: italic; text-align: center;">No intraday slots submitted</td>`;
        }

        if (idx === 0) {
          const eodStatusColor = group.eodEntry?.isPending ? '#f59e0b' : (group.eodEntry?.onTime ? '#16a34a' : (group.eodEntry ? '#ea580c' : '#6b7280'));
          htmlRow += `<td rowspan="${rowCount}" style="${eodStyle}">${eodTime}</td>`;
          htmlRow += `<td rowspan="${rowCount}" style="${eodStyle} color: ${eodStatusColor}; font-weight: bold;">${eodStatus}</td>`;
          htmlRow += `<td rowspan="${rowCount}" style="${eodTextStyle}">${group.eodEntry?.text || ""}</td>`;
          htmlRow += `<td rowspan="${rowCount}" style="${eodStyle}">${eodBlockers}</td>`;
        }
        htmlRow += `</tr>`;
        bodyHtml += htmlRow;
      });
    });
    
    const tsv = [headers, ...rows].map((row) => row.join("\t")).join("\n");
    
    const headerHtml = `<tr>${headers.map((h, i) => {
      const isEod = i >= headers.length - 4;
      const isLongText = h === "Pulse Text" || h === "EOD Brief" || h === "Blockers" || h === "EOD Blockers";
      let style = isLongText ? 'width: 300px; min-width: 300px;' : 'white-space: nowrap;';
      if (h === "Slot") style = 'width: 250px; min-width: 250px; white-space: nowrap;';
      return `<th style="border: 1px solid #d1d5db; ${isEod ? 'border-left: 2px solid #9ca3af; background-color: #e2e8f0;' : 'background-color: #f3f4f6;'} padding: 10px 8px; font-weight: bold; text-align: left; font-family: sans-serif; ${style}">${h}</th>`;
    }).join("")}</tr>`;
    
    const html = `<table style="border-collapse: collapse; font-family: sans-serif; font-size: 14px;"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`;

    try {
      const textBlob = new Blob([tsv], { type: "text/plain" });
      const htmlBlob = new Blob([html], { type: "text/html" });
      const clipboardItem = new ClipboardItem({
        "text/plain": textBlob,
        "text/html": htmlBlob,
      });
      navigator.clipboard.write([clipboardItem]);
    } catch (e) {
      // Fallback for older browsers
      navigator.clipboard.writeText(tsv);
    }
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={isEmbedded ? "space-y-6" : "px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-6"}>
      {isEmbedded ? (
        <div className="flex justify-end">
          <button
            onClick={copyToClipboard}
            className="inline-flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy as Excel"}
          </button>
        </div>
      ) : (
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary mb-2">
              Gharpayy · Daily Pulse
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Organization Pulses
            </h1>
            <p className="text-muted-foreground mt-2">
              Live feed of all daily pulses across the organization.
            </p>
          </div>
          <div className="flex flex-col gap-4 w-full md:w-auto mt-4 md:mt-0">
            <div className="flex flex-wrap items-center gap-3 w-full justify-start md:justify-end">
              <div id="tour-admin-pulse-search" className="relative w-full md:w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search name, text, or brief..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                />
              </div>

              <div id="tour-admin-pulse-daterange" className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
                <Select value={dateRangeOption} onValueChange={(val) => setDateRangeOption(val)}>
                  <SelectTrigger className="w-full md:w-[200px] h-10 bg-card">
                    <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="14days">Last 14 Days</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
                
                {dateRangeOption === "custom" && (
                  <div className="flex items-center gap-2 animate-in fade-in duration-200">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="h-10 w-full md:w-[130px] rounded-lg border border-input bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="text-muted-foreground text-xs font-medium">to</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="h-10 w-full md:w-[130px] rounded-lg border border-input bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                )}
              </div>

              <button
                id="tour-admin-pulse-filters"
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-all ${
                  showFilters 
                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm" 
                    : "bg-card border-border text-foreground hover:bg-muted/50"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {(nameFilter !== "all" || teamFilter !== "all" || roleFilter !== "all" || slotFilter !== "all" || statusFilter !== "all" || callsFilter !== "all" || toursFilter !== "all" || closuresFilter !== "all" || blockersFilter !== "all" || mediaFilter !== "all") && (
                  <span className="flex h-2 w-2 rounded-full bg-primary" />
                )}
              </button>

              <button
                id="tour-admin-pulse-export"
                onClick={copyToClipboard}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {copied ? "Copied" : "Export"}
              </button>
            </div>

            {!isSingleDay && (
              <div className="p-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-primary/5 animate-in slide-in-from-top-2 fade-in duration-200 flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-primary">Date Range Report</div>
                  <div className="text-sm font-semibold text-foreground">{dateRangeLabel}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground font-mono">{entries.length} total pulses</div>
                </div>
              </div>
            )}

            {showFilters && (
              <div className="p-4 rounded-xl border border-border bg-card/50 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2 fade-in duration-200">
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1 block">Name</label>
                  <Select value={nameFilter} onValueChange={(val) => setNameFilter(val)}>
                    <SelectTrigger className="h-9 text-xs bg-card">
                      <SelectValue placeholder="All names" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All names</SelectItem>
                      {names.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {teams.length > 0 && (
                  <div>
                    <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1 block">Team</label>
                    <Select value={teamFilter} onValueChange={(val) => setTeamFilter(val)}>
                      <SelectTrigger className="h-9 text-xs bg-card">
                        <SelectValue placeholder="All teams" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All teams</SelectItem>
                        {teams.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {roles.length > 0 && (
                  <div>
                    <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1 block">Role</label>
                    <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val)}>
                      <SelectTrigger className="h-9 text-xs bg-card">
                        <SelectValue placeholder="All roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1 block">Slot</label>
                  <Select value={slotFilter} onValueChange={(val) => setSlotFilter(val)}>
                    <SelectTrigger className="h-9 text-xs bg-card">
                      <SelectValue placeholder="All slots" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All slots</SelectItem>
                      {SLOTS.map((s) => (
                        <SelectItem key={s.key} value={s.key}>{s.label.split(" · ")[0]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1 block">Status</label>
                  <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                    <SelectTrigger className="h-9 text-xs bg-card">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="onTime">All On Time</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1 block">Calls</label>
                  <Select value={callsFilter} onValueChange={(val) => setCallsFilter(val)}>
                    <SelectTrigger className="h-9 text-xs bg-card">
                      <SelectValue placeholder="Calls: All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Calls: All</SelectItem>
                      <SelectItem value="highVolume">High (10+) ({counts.highCalls})</SelectItem>
                      <SelectItem value="mediumVolume">Medium (5-9) ({counts.medCalls})</SelectItem>
                      <SelectItem value="lowVolume">Low (1-4) ({counts.lowCalls})</SelectItem>
                      <SelectItem value="noCalls">No Calls (0) ({counts.noCalls})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1 block">Tours</label>
                  <Select value={toursFilter} onValueChange={(val) => setToursFilter(val)}>
                    <SelectTrigger className="h-9 text-xs bg-card">
                      <SelectValue placeholder="Tours: All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tours: All</SelectItem>
                      <SelectItem value="multipleTours">Multiple Tours (2+) ({counts.multipleTours})</SelectItem>
                      <SelectItem value="singleTour">One Tour (1) ({counts.singleTour})</SelectItem>
                      <SelectItem value="noTours">No Tours (0) ({counts.noTours})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1 block">Closures</label>
                  <Select value={closuresFilter} onValueChange={(val) => setClosuresFilter(val)}>
                    <SelectTrigger className="h-9 text-xs bg-card">
                      <SelectValue placeholder="Closures: All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Closures: All</SelectItem>
                      <SelectItem value="multipleClosures">Multiple Closures (2+) ({counts.multipleClosures})</SelectItem>
                      <SelectItem value="singleClosure">One Closure (1) ({counts.singleClosure})</SelectItem>
                      <SelectItem value="noClosures">No Closures (0) ({counts.noClosures})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1 block">Blockers</label>
                  <Select value={blockersFilter} onValueChange={(val) => setBlockersFilter(val as any)}>
                    <SelectTrigger className="h-9 text-xs bg-card">
                      <SelectValue placeholder="All blockers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All pulses</SelectItem>
                      <SelectItem value="hasBlockers">Has Blockers ({counts.hasBlockers})</SelectItem>
                      <SelectItem value="noBlockers">No Blockers ({counts.noBlockers})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1 block">Proof of Work</label>
                  <Select value={mediaFilter} onValueChange={(val) => setMediaFilter(val)}>
                    <SelectTrigger className="h-9 text-xs bg-card">
                      <SelectValue placeholder="Proof: All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Proof: All</SelectItem>
                      <SelectItem value="hasMedia">Has Proof ({counts.hasMedia})</SelectItem>
                      <SelectItem value="noMedia">No Proof ({counts.noMedia})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </header>
      )}


      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto pb-4">
          {!isSingleDay ? (
            /* ── WEEK VIEW TABLE ── */
            <table className="w-full text-sm text-left whitespace-nowrap min-w-[1600px]">
              <thead className="bg-muted/50 text-muted-foreground text-xs font-semibold tracking-wider border-b border-border">
                <tr>
                  <th className="px-3 py-3 border-r border-border/20">Name</th>
                  <th className="px-3 py-3 border-r border-border/20">Role</th>
                  <th className="px-3 py-3 border-r border-border/20">Team</th>
                  <th className="px-3 py-3 border-r border-border/20">Date</th>
                  <th className="px-3 py-3 border-r border-border/20">Slot</th>
                  <th className="px-3 py-3 border-r border-border/20">Time</th>
                  <th className="px-3 py-3 border-r border-border/20">Status</th>
                  <th className="px-3 py-3 border-r border-border/20 text-right">Calls</th>
                  <th className="px-3 py-3 border-r border-border/20 text-right">Tours</th>
                  <th className="px-3 py-3 border-r border-border/20 text-right">Closures</th>
                  <th className="px-3 py-3 border-r border-border/20 min-w-[150px]">Blockers</th>
                  <th className="px-3 py-3 border-r border-border/20 min-w-[200px]">Pulse Text</th>
                  <th className="px-3 py-3">Proof of Work</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groupedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-6 py-8 text-center text-muted-foreground">
                      No pulses submitted for {dateRangeLabel}.
                    </td>
                  </tr>
                ) : (
                  groupedEntries.map((group) => {
                    // Collect ALL entries (regular + EOD) and sort by date → slot
                    const allEmpEntries = [
                      ...group.regularEntries.filter((e): e is NonNullable<typeof e> => e !== null),
                      ...(group.eodEntry ? [group.eodEntry] : []),
                    ].sort((a, b) => {
                      const dateCompare = a.date.localeCompare(b.date);
                      if (dateCompare !== 0) return dateCompare;
                      const slotOrder: Record<string, number> = { slot1: 1, slot2: 2, slot3: 3, eod: 4 };
                      return (slotOrder[a.slot] || 99) - (slotOrder[b.slot] || 99);
                    });

                    if (allEmpEntries.length === 0) return null;

                    return (
                      <Fragment key={group.empId}>
                        {allEmpEntries.map((e, idx) => {
                          const dateObj = new Date(e.date + "T12:00:00");
                          const isLastRow = idx === allEmpEntries.length - 1;
                          // Check if this is the first entry of a new date for visual separation
                          const prevDate = idx > 0 ? allEmpEntries[idx - 1].date : null;
                          const isNewDate = e.date !== prevDate;
                          const isEod = e.slot === "eod";
                          return (
                            <tr
                              key={e.id}
                              className={`hover:bg-muted/30 transition-colors ${
                                isLastRow ? "border-b-2 border-border" : ""
                              } ${
                                isEod ? "bg-muted/20" : ""
                              }`}
                            >
                              <td className="px-3 py-2 align-top font-medium text-foreground border-r border-border/20">
                                {group.empName}
                              </td>
                              <td className="px-3 py-2 align-top text-muted-foreground border-r border-border/20">
                                {group.role}
                              </td>
                              <td className="px-3 py-2 align-top text-muted-foreground border-r border-border/20">
                                {group.team}
                              </td>
                              <td className={`px-3 py-2 align-top border-r border-border/20 font-mono text-xs text-foreground font-semibold`}>
                                {format(dateObj, "EEE, d MMM")}
                              </td>
                              <td className={`px-3 py-2 align-top border-r border-border/20 ${
                                isEod ? "text-primary font-semibold" : "text-foreground/90"
                              }`}>
                                {isEod ? "EOD Brief" : (
                                  <>
                                    {SLOTS.find((s) => s.key === e.slot)?.label.split(" · ")[0] || e.slot}
                                    <span className="text-muted-foreground ml-1 text-xs">
                                      ({SLOTS.find((s) => s.key === e.slot)?.window})
                                    </span>
                                  </>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top text-foreground/90 border-r border-border/20 text-right">
                                {e.isPending ? "—" : new Date(e.submittedAt).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className={`px-3 py-2 align-top font-medium border-r border-border/20 ${e.isPending ? "text-amber-500" : (e.onTime ? "text-success" : "text-destructive")}`}>
                                {e.isPending ? "Pending" : (e.onTime ? "On Time" : "Late")}
                              </td>
                              <td className="px-3 py-2 align-top text-right tabular-nums border-r border-border/20">
                                {e.calls ?? ""}
                              </td>
                              <td className="px-3 py-2 align-top text-right tabular-nums border-r border-border/20">
                                {e.tours ?? ""}
                              </td>
                              <td className="px-3 py-2 align-top text-right tabular-nums border-r border-border/20">
                                {e.closures ?? ""}
                              </td>
                              <td className="px-3 py-2 align-top whitespace-pre-wrap break-words border-r border-border/20 text-foreground/90">
                                {e.blockers ?? ""}
                              </td>
                              <td className="px-3 py-2 align-top whitespace-pre-wrap break-words border-r border-border/20 text-foreground/90 text-xs">
                                {e.text}
                              </td>
                              <td className="px-3 py-2 align-top">
                                {e.mediaUrls && e.mediaUrls.length > 0 ? (
                                  <button
                                    onClick={() => setViewImages(e.mediaUrls!)}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-medium rounded transition-colors"
                                  >
                                    <ImageIcon className="h-3 w-3" /> View {e.mediaUrls.length > 1 ? `(${e.mediaUrls.length})` : ""}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ── DAY VIEW TABLE (original) ── */
            <table className="w-full text-sm text-left whitespace-nowrap min-w-[1500px]">
              <thead className="bg-muted/50 text-muted-foreground text-xs font-semibold tracking-wider border-b border-border">
                <tr>
                  <th className="px-3 py-3 border-r border-border/20">Name</th>
                  <th className="px-3 py-3 border-r border-border/20">Role</th>
                  <th className="px-3 py-3 border-r border-border/20">Team</th>
                  <th className="px-3 py-3 border-r border-border/20">Slot</th>
                  <th className="px-3 py-3 border-r border-border/20">Time</th>
                  <th className="px-3 py-3 border-r border-border/20">Status</th>
                  <th className="px-3 py-3 border-r border-border/20 text-right">Calls</th>
                  <th className="px-3 py-3 border-r border-border/20 text-right">Tours</th>
                  <th className="px-3 py-3 border-r border-border/20 text-right">Closures</th>
                  <th className="px-3 py-3 border-r border-border/20 min-w-[150px]">Blockers</th>
                  <th className="px-3 py-3 border-r border-border/20 min-w-[200px]">Pulse Text</th>
                  <th className="px-3 py-3 border-r border-border/20">Proof of Work</th>
                  <th className="px-3 py-3 border-r border-border/20">EOD Time</th>
                  <th className="px-3 py-3 border-r border-border/20">EOD Status</th>
                  <th className="px-3 py-3 border-r border-border/20 min-w-[200px]">EOD Brief</th>
                  <th className="px-3 py-3 min-w-[150px]">EOD Blockers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groupedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="px-6 py-8 text-center text-muted-foreground">
                      No pulses submitted{startIso === todayISO() && isSingleDay ? " yet today" : ` for ${new Date(startIso + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}`}.
                    </td>
                  </tr>
                ) : (
                  groupedEntries.map((group) => (
                    <Fragment key={group.empId}>
                      {(group.regularEntries.length > 0 ? group.regularEntries : [null]).map((e, idx, arr) => (
                        <tr key={e?.id || `empty-${group.empId}-${idx}`} className={`hover:bg-muted/30 transition-colors ${idx === arr.length - 1 ? "border-b-2 border-border" : ""}`}>
                          <td className="px-3 py-2 align-top font-medium text-foreground border-r border-border/20">
                            {group.empName}
                          </td>
                          <td className="px-3 py-2 align-top text-muted-foreground border-r border-border/20">
                            {group.role}
                          </td>
                          <td className="px-3 py-2 align-top text-muted-foreground border-r border-border/20">
                            {group.team}
                          </td>
                          
                          {e ? (
                            <>
                              <td className="px-3 py-2 align-top border-r border-border/20 text-foreground/90">
                                {SLOTS.find((s) => s.key === e.slot)?.label.split(" · ")[0] || e.slot}
                                <span className="text-muted-foreground ml-1 text-xs">
                                  ({SLOTS.find((s) => s.key === e.slot)?.window})
                                </span>
                              </td>
                              <td className="px-3 py-2 align-top text-foreground/90 border-r border-border/20 text-right">
                                {e.isPending ? "—" : new Date(e.submittedAt).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className={`px-3 py-2 align-top font-medium border-r border-border/20 ${e.isPending ? "text-amber-500" : (e.onTime ? "text-success" : "text-destructive")}`}>
                                {e.isPending ? "Pending" : (e.onTime ? "On Time" : "Late")}
                              </td>
                              <td className="px-3 py-2 align-top text-right tabular-nums border-r border-border/20">
                                {e.calls ?? ""}
                              </td>
                              <td className="px-3 py-2 align-top text-right tabular-nums border-r border-border/20">
                                {e.tours ?? ""}
                              </td>
                              <td className="px-3 py-2 align-top text-right tabular-nums border-r border-border/20">
                                {e.closures ?? ""}
                              </td>
                              <td className="px-3 py-2 align-top whitespace-pre-wrap break-words border-r border-border/20 text-foreground/90">
                                {e.blockers ?? ""}
                              </td>
                              <td className="px-3 py-2 align-top whitespace-pre-wrap break-words border-r border-border/20 text-foreground/90 text-xs">
                                {e.text}
                              </td>
                              <td className="px-3 py-2 align-top border-r border-border/20">
                                {e.mediaUrls && e.mediaUrls.length > 0 ? (
                                  <button
                                    onClick={() => setViewImages(e.mediaUrls!)}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-medium rounded transition-colors"
                                  >
                                    <ImageIcon className="h-3 w-3" /> View {e.mediaUrls.length > 1 ? `(${e.mediaUrls.length})` : ""}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                            </>
                          ) : (
                            <td colSpan={9} className="px-3 py-2 text-muted-foreground italic border-r border-border/20">
                              {statusFilter === "pending" ? "No pending intraday slots." : "No intraday slots submitted yet."}
                            </td>
                          )}

                          {idx === 0 ? (
                            <>
                              {group.eodEntry ? (
                                <>
                                  <td rowSpan={Math.max(1, group.regularEntries.length)} className="px-3 py-2 align-top border-r border-border/20 text-foreground/90 text-right">
                                    {group.eodEntry.isPending ? "—" : new Date(group.eodEntry.submittedAt).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </td>
                                  <td rowSpan={Math.max(1, group.regularEntries.length)} className={`px-3 py-2 align-top font-medium border-r border-border/20 ${group.eodEntry.isPending ? "text-amber-500" : (group.eodEntry.onTime ? "text-success" : "text-destructive")}`}>
                                    {group.eodEntry.isPending ? "Pending" : (group.eodEntry.onTime ? "On Time" : "Late")}
                                  </td>
                                  <td rowSpan={Math.max(1, group.regularEntries.length)} className="px-3 py-2 align-top whitespace-pre-wrap break-words border-r border-border/20 text-foreground/90 text-xs">
                                    {group.eodEntry.text}
                                  </td>
                                  <td rowSpan={Math.max(1, group.regularEntries.length)} className="px-3 py-2 align-top whitespace-pre-wrap break-words text-foreground/90">
                                    {group.eodEntry.blockers ?? ""}
                                  </td>
                                </>
                              ) : (
                                <td colSpan={4} rowSpan={Math.max(1, group.regularEntries.length)} className="px-3 py-2 align-top text-muted-foreground italic opacity-70">
                                  Pending EOD
                                </td>
                              )}
                            </>
                          ) : null}
                        </tr>
                      ))}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {absentEmployees.length > 0 && (
        <div className="mt-8 border border-destructive/20 bg-destructive/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-4">
            <AlertCircle className="h-5 w-5" />
            <h3>Absent Today</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {absentEmployees.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 bg-card border border-border p-3 rounded-xl shadow-sm">
                <Avatar id={emp.id} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-foreground">{emp.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                    {emp.role} · {emp.team}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewImages && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-start p-4 md:p-10 backdrop-blur-sm cursor-pointer overflow-y-auto"
          onClick={closeViewer}
        >
          <div className="relative max-w-5xl w-full flex flex-col items-center gap-8 py-10 my-auto" onClick={e => e.stopPropagation()}>
            <button 
              onClick={closeViewer}
              className="sticky top-4 self-end md:-mr-12 bg-secondary text-foreground rounded-full p-2 hover:bg-destructive hover:text-white transition-colors z-10 shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
            {viewImages.map((url, idx) => (
              <img key={idx} src={url} alt={`Proof of Work ${idx+1}`} className="max-w-full max-h-[85vh] rounded-md shadow-2xl object-contain bg-black" />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
