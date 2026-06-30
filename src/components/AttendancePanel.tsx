import { useState } from "react";
import {
  EventKind,
  fmtDuration,
  fmtTime,
  getGeo,
  liveStatusFor,
  logEvent,
  reverseGeocode,
  todaySummary,
} from "@/lib/attendance-store";
import { useAttendanceState } from "@/hooks/useAttendance";
import { SelfieCapture } from "@/components/SelfieCapture";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Coffee,
  LogIn,
  LogOut,
  MapPin,
  Navigation2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

const ACTION_LABEL: Record<EventKind, string> = {
  clock_in: "Clock In",
  clock_out: "Clock Out",
  break_start: "Start Break",
  break_end: "End Break",
  field_start: "Start Field Visit",
  field_end: "End Field Visit",
};

export function AttendancePanel() {
  const { actor } = useAttendanceState();
  const summary = todaySummary(actor.id);
  const status = summary.status;

  const [pending, setPending] = useState<EventKind | null>(null);
  const [busy, setBusy] = useState(false);

  const trigger = (kind: EventKind) => setPending(kind);

  const handleSelfie = async (selfie: string) => {
    if (!pending) return;
    const kind = pending;
    setPending(null);
    setBusy(true);
    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | null = null;
    let address: string | null = null;
    try {
      const fix = await getGeo();
      lat = fix.lat;
      lng = fix.lng;
      accuracy = fix.accuracy;
      address = await reverseGeocode(fix.lat, fix.lng);
    } catch {
      toast.warning("Location unavailable", {
        description: "Logged without geo. Enable location for full audit trail.",
      });
    }
    logEvent({ employeeId: actor.id, kind, lat, lng, accuracy, address, selfie });
    toast.success(`${ACTION_LABEL[kind]} recorded`, {
      description: address || "Geo skipped",
    });
    setBusy(false);
  };

  // Which actions are valid for the current status
  const can = {
    clock_in: status === "Off",
    clock_out: status === "Clocked In" || status === "On Break" || status === "In Field",
    break_start: status === "Clocked In",
    break_end: status === "On Break",
    field_start: status === "Clocked In",
    field_end: status === "In Field",
  };

  const statusColor =
    status === "Clocked In"
      ? "bg-success/15 text-success border-success/30"
      : status === "On Break"
        ? "bg-warning/15 text-warning border-warning/30"
        : status === "In Field"
          ? "bg-primary/15 text-primary border-primary/30"
          : "bg-muted text-muted-foreground border-border";

  return (
    <>
      <Card className="p-5 bg-card border-border max-w-full min-w-0">
        <div className="flex items-start justify-between gap-3 mb-5">
          <Badge
            variant="outline"
            className={`${statusColor} border font-mono text-[10px] uppercase tracking-widest`}
          >
            {status}
          </Badge>
        </div>

        {/* Live counters */}
        <div className="flex flex-wrap gap-2 mb-5 min-w-0">
          <Stat label="Work" value={fmtDuration(summary.workMs)} live={status === "Clocked In"} />
          <Stat label="Break" value={fmtDuration(summary.breakMs)} live={status === "On Break"} />
          <Stat label="Field" value={fmtDuration(summary.fieldMs)} live={status === "In Field"} />
        </div>

        {/* Primary actions */}
        <div className="grid grid-cols-2 gap-2 mb-2 min-w-0">
          <Button
            size="lg"
            onClick={() => trigger("clock_in")}
            disabled={!can.clock_in || busy}
            className="h-14"
          >
            <LogIn className="h-5 w-5 mr-2" /> Clock In
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={() => trigger("clock_out")}
            disabled={!can.clock_out || busy}
            className="h-14"
          >
            <LogOut className="h-5 w-5 mr-2" /> Clock Out
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 min-w-0">
          <Button
            variant="outline"
            onClick={() => trigger(can.break_end ? "break_end" : "break_start")}
            disabled={!(can.break_start || can.break_end) || busy}
          >
            <Coffee className="h-4 w-4 mr-2" />
            {can.break_end ? "End Break" : "Start Break"}
          </Button>
          <Button
            variant="outline"
            onClick={() => trigger(can.field_end ? "field_end" : "field_start")}
            disabled={!(can.field_start || can.field_end) || busy}
          >
            <Navigation2 className="h-4 w-4 mr-2" />
            {can.field_end ? "End Field" : "Start Field"}
          </Button>
        </div>

        {busy && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Capturing geo + logging…
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {summary.firstClockIn ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                First in {fmtTime(summary.firstClockIn)}
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                Not clocked in yet today
              </>
            )}
          </span>
          {summary.lastClockOut && <span>Last out {fmtTime(summary.lastClockOut)}</span>}
        </div>
      </Card>

      <SelfieCapture
        open={pending !== null}
        title={pending ? `Selfie for ${ACTION_LABEL[pending]}` : ""}
        subtitle="Face the camera. Geo will be captured next."
        onClose={() => setPending(null)}
        onCapture={handleSelfie}
      />
    </>
  );
}

function Stat({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="flex-1 min-w-0 rounded-md bg-card border border-border p-3 overflow-hidden">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono flex items-center gap-1">
        {label}
        {live && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
      </div>
      <div className="font-display text-xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
