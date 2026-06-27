import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCalendarEvents, eventColor } from "@/lib/calendar-store";

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(ts: number) {
  const d = new Date(ts);
  const t = new Date();
  const diff = Math.round((d.setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return new Date(ts).toLocaleDateString(undefined, { weekday: "long" });
  return new Date(ts).toLocaleDateString();
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CalendarPeek({ open, onClose }: Props) {
  const events = useCalendarEvents();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  if (!open) return null;

  const upcoming = events.filter((e) => e.endAt >= Date.now()).slice(0, 6);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="font-display font-semibold text-sm">Calendar peek</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Next up
          </div>
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
        {upcoming.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Calendar is open. Plan something good.
          </div>
        )}
        {upcoming.map((e) => (
          <div key={e.id} className="px-4 py-3 flex gap-3 items-start">
            <div className="text-right shrink-0 w-16">
              <div className="text-xs font-mono text-muted-foreground">{dayLabel(e.startAt)}</div>
              <div className="text-sm font-semibold">{fmt(e.startAt)}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`inline-block text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border mb-1 ${eventColor(e.type)}`}
              >
                {e.type}
              </div>
              <div className="font-medium text-sm truncate">{e.title}</div>
              {e.location && (
                <div className="text-xs text-muted-foreground truncate">{e.location}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          navigate({ to: "/calendar" });
          onClose();
        }}
        className="w-full px-4 py-3 text-center text-xs font-medium text-primary hover:bg-secondary/50 border-t border-border"
      >
        Open calendar →
      </button>
    </div>
  );
}
