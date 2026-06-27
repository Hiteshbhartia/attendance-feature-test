import { AttEvent, fmtTime } from "@/lib/attendance-store";
import { Coffee, LogIn, LogOut, MapPin, Navigation2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";

const META: Record<
  AttEvent["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  clock_in: {
    label: "Clocked In",
    icon: LogIn,
    tone: "text-success border-success/40 bg-success/10",
  },
  clock_out: {
    label: "Clocked Out",
    icon: LogOut,
    tone: "text-destructive border-destructive/40 bg-destructive/10",
  },
  break_start: {
    label: "Break Started",
    icon: Coffee,
    tone: "text-warning border-warning/40 bg-warning/10",
  },
  break_end: {
    label: "Break Ended",
    icon: Coffee,
    tone: "text-foreground border-border bg-muted/40",
  },
  field_start: {
    label: "Field Visit Started",
    icon: Navigation2,
    tone: "text-primary border-primary/40 bg-primary/10",
  },
  field_end: {
    label: "Field Visit Ended",
    icon: Navigation2,
    tone: "text-foreground border-border bg-muted/40",
  },
};

export function EventTimeline({ events }: { events: AttEvent[] }) {
  if (!events.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12 border border-dashed border-border rounded-md">
        No attendance events yet today.
      </div>
    );
  }
  const sorted = [...events].sort((a, b) => b.ts - a.ts);
  return (
    <ol className="space-y-3">
      {sorted.map((e) => {
        const m = META[e.kind];
        const Icon = m.icon;
        return (
          <li key={e.id} className="flex gap-3 items-start">
            <div
              className={`shrink-0 h-10 w-10 rounded-full border flex items-center justify-center ${m.tone}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 rounded-md bg-card border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{m.label}</div>
                <div className="text-xs text-muted-foreground font-mono tabular-nums">
                  {fmtTime(e.ts)}
                </div>
              </div>
              {e.address && (
                <div className="mt-1 text-xs text-muted-foreground flex items-start gap-1 min-w-0">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="truncate flex-1 min-w-0" title={e.address}>
                    {e.address}
                  </span>
                </div>
              )}
              {typeof e.lat === 'number' && typeof e.lng === 'number' && (
                <div className="mt-1 text-[10px] text-muted-foreground/80 font-mono">
                  {e.lat.toFixed(5)}, {e.lng.toFixed(5)}
                  {e.accuracy ? ` · ±${Math.round(e.accuracy)}m` : ""}
                </div>
              )}
              {e.selfie && (
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="mt-2 inline-block focus:outline-none">
                      <img
                        src={e.selfie}
                        alt="Selfie"
                        className="h-16 w-16 rounded-md object-cover border border-border transition-transform hover:scale-105"
                      />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md p-2 overflow-hidden bg-background/50 backdrop-blur-md border-border shadow-2xl rounded-xl">
                    <DialogTitle className="sr-only">Selfie Preview</DialogTitle>
                    <img
                      src={e.selfie}
                      alt="Selfie"
                      className="w-full max-h-[80vh] object-contain rounded-lg"
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
