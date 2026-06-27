import { useState, useEffect } from "react";
import { Clock, AlertCircle } from "lucide-react";

export function LiveCountdown({ targetTimeMs }: { targetTimeMs: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const diffMs = targetTimeMs - now;
  const isOverdue = diffMs < 0;
  const absMs = Math.abs(diffMs);

  const totalSeconds = Math.floor(absMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");

  if (isOverdue) {
    return (
      <div className="flex items-center gap-1.5 text-destructive font-mono text-sm font-semibold">
        <AlertCircle className="h-4 w-4" />
        <span>-{hh}:{mm}:{ss} overdue</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-primary font-mono text-sm font-semibold">
      <Clock className="h-4 w-4" />
      <span>{hh}:{mm}:{ss} remaining</span>
    </div>
  );
}
