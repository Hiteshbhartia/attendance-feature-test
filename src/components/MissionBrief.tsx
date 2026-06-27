import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Bot, Loader2 } from "lucide-react";
import type { Employee } from "@/types/hr";
import { fetchAiMissionFor, fallbackMissionFor, type MissionItem, TIER_MISSION_LABEL } from "@/lib/priority-engine";
import { tierOf } from "@/lib/permissions";
import { useEvents } from "@/lib/event-bus";

const toneClass: Record<string, string> = {
  urgent: "border-destructive/30 bg-destructive/5",
  warn: "border-warning/30 bg-warning/5",
  info: "border-info/30 bg-info/5",
  neutral: "border-border bg-card",
};

const dotClass: Record<string, string> = {
  urgent: "bg-destructive",
  warn: "bg-warning",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

export function MissionBrief({ actor }: { actor: Employee }) {
  // re-render when event spine moves
  useEvents();
  const tier = tierOf(actor);
  
  const [items, setItems] = useState<MissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    fetchAiMissionFor(actor).then(fetchedItems => {
      if (mounted) {
        setItems(fetchedItems);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) {
        setItems(fallbackMissionFor(actor));
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [actor]);

  return (
    <section id="tour-home-mission" className="rounded-xl border border-border bg-gradient-to-br from-card to-muted/30 p-4 md:p-5 mb-6">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {TIER_MISSION_LABEL[tier]}
            </div>
            <h2 className="font-display text-lg font-semibold leading-tight">
              What demands you right now
            </h2>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </header>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center text-muted-foreground animate-pulse">
          <Loader2 className="h-6 w-6 animate-spin mb-3 text-primary/50" />
          <div className="text-sm">AI is analyzing your context...</div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
          Inbox zero. Floor is clean. Pick a stretch goal.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                to={it.to}
                className={`flex items-center gap-3 p-3 rounded-md border ${toneClass[it.tone]} hover:bg-muted/40 transition group`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass[it.tone]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {it.kicker}
                  </div>
                  <div className="text-sm font-medium truncate">{it.title}</div>
                  {it.body && (
                    <div className="text-xs text-muted-foreground truncate">{it.body}</div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
