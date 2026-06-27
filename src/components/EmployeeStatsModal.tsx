import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useRosterState } from "@/hooks/useRoster";
import { Avatar } from "@/components/Avatar";
import { Loader2, Calendar, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";

interface EmployeeStatsModalProps {
  empId: string | null;
  onClose: () => void;
}

export function EmployeeStatsModal({ empId, onClose }: EmployeeStatsModalProps) {
  const { roster } = useRosterState();
  const [loading, setLoading] = useState(true);
  const [daysVisited, setDaysVisited] = useState(0);
  const [goalsReached, setGoalsReached] = useState(0);

  const employee = roster.find((e) => e.id === empId);

  useEffect(() => {
    if (!empId) return;
    let isMounted = true;
    
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch attendance events for the employee
        const attRes = await api.get<{ items: { kind: string; ts: number }[] }>(`/attendance-events?employeeId=${empId}`);
        // Calculate unique days visited (days where they had a clock_in event)
        const clockIns = (attRes.items || []).filter(e => e.kind === "clock_in");
        const uniqueDays = new Set(clockIns.map(e => new Date(e.ts).toDateString()));
        if (isMounted) setDaysVisited(uniqueDays.size);

        // Fetch tasks for the employee
        const tasksRes = await api.get<{ items: { status: string }[] }>(`/tasks?assigneeId=${empId}`);
        const completedTasks = (tasksRes.items || []).filter(t => t.status === "done").length;
        if (isMounted) setGoalsReached(completedTasks);
      } catch (err) {
        console.error("Failed to fetch employee stats:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [empId]);

  return (
    <Dialog open={!!empId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {employee ? (
          <>
            <DialogHeader className="mb-4 flex flex-row items-center gap-4 space-y-0 text-left">
              <Avatar id={employee.id} size={56} />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">
                  Employee Stats
                </div>
                <h1 className="font-display text-xl font-semibold tracking-tight leading-tight">{employee.name}</h1>
                <p className="text-muted-foreground text-xs">{employee.role}</p>
              </div>
            </DialogHeader>

            {loading ? (
              <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="rounded-xl bg-card border border-border p-4 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1 leading-tight">
                    Days Visited
                  </div>
                  <div className="font-display text-4xl font-semibold tabular-nums text-primary mt-1">
                    {daysVisited}
                  </div>
                </div>

                <div className="rounded-xl bg-card border border-border p-4 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success mb-3">
                    <Target className="h-5 w-5" />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1 leading-tight">
                    Goals Reached
                  </div>
                  <div className="font-display text-4xl font-semibold tabular-nums text-success mt-1">
                    {goalsReached}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Employee not found.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
