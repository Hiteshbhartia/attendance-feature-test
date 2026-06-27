import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLeaves, applyLeave, reviewLeave } from "@/lib/leave-store";
import { useAttendanceState } from "@/hooks/useAttendance";
import { type LeaveStatus, type LeaveType } from "@/types/hr";
import { getRoster } from "@/lib/roster";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";
import { Plus, X, Check, Clock, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/leaves")({
  component: LeavesPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

const STATUS_TONE: Record<LeaveStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function LeavesPage() {
  const { actor } = useAttendanceState();
  const leaves = useLeaves();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"mine" | "queue">("mine");

  const mine = leaves.filter((l) => l.employeeId === actor.id);
  const queue = leaves.filter((l) => {
    const emp = getRoster().find((e) => e.id === l.employeeId);
    return emp && (emp.managerId === actor.id || actor.appRole === "admin" || actor.role === "HR");
  });


  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<LeaveType | "all">("all");

  const visibleLeaves = (tab === "mine" ? mine : queue).filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (typeFilter !== "all" && l.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1100px] mx-auto">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
            Time Off
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">Leaves</h1>
          <p className="text-muted-foreground text-sm mt-1">Apply, approve, plan ahead.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Apply
        </button>
      </header>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="w-[130px]">
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[120px]">
          <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val as any)}>
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="Casual">Casual</SelectItem>
              <SelectItem value="Sick">Sick</SelectItem>
              <SelectItem value="Earned">Earned</SelectItem>
              <SelectItem value="Unpaid">Unpaid</SelectItem>
              <SelectItem value="WFH">WFH</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-4 w-px bg-border mx-1" />
        <div className="grid grid-cols-2 gap-1 bg-secondary p-1 rounded-md max-w-xs">
          <button
            onClick={() => setTab("mine")}
            className={`text-xs font-medium px-3 py-1.5 rounded ${
              tab === "mine" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            My leaves
          </button>
          <button
            onClick={() => setTab("queue")}
            className={`text-xs font-medium px-3 py-1.5 rounded ${
              tab === "queue" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            Approval queue
          </button>
        </div>
      </div>


      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {visibleLeaves.map((l) => {
          const emp = getRoster().find((e) => e.id === l.employeeId);
          const canReview = tab === "queue" && l.status === "pending";
          return (
            <div
              key={l.id}
              className="px-4 md:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {emp && <Avatar id={emp.id} size={36} />}
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {emp?.name}{" "}
                    <span className="text-muted-foreground font-normal">· {l.type}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {l.startDate}
                    {l.endDate !== l.startDate ? ` → ${l.endDate}` : ""} · {l.reason}
                  </div>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border self-start ${STATUS_TONE[l.status]}`}
              >
                {l.status}
              </span>
              {canReview && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      reviewLeave(l.id, actor.id, "approved");
                      toast.success("Approved");
                    }}
                    className="text-xs px-3 py-1.5 rounded-md border border-success/40 text-success hover:bg-success/10 inline-flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      reviewLeave(l.id, actor.id, "rejected");
                      toast("Rejected");
                    }}
                    className="text-xs px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {visibleLeaves.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            <Clock className="h-5 w-5 mx-auto mb-2 opacity-40" />
            Nothing here.
          </div>
        )}
      </div>

      {open && <ApplyModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function ApplyModal({ onClose }: { onClose: () => void }) {
  const { actor } = useAttendanceState();
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<LeaveType>("Casual");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [reason, setReason] = useState("");
  const ok = reason.trim().length >= 4 && start <= end;

  return (
    <div
      className="fixed inset-0 z-[100] bg-sidebar/50 backdrop-blur-sm flex items-end md:items-center justify-center px-2 md:px-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="font-display font-semibold">Apply for leave</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Type
            </label>
            <div className="mt-1 grid grid-cols-5 gap-1">
              {(["Casual", "Sick", "Earned", "Unpaid", "WFH"] as LeaveType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`text-[10px] py-2 rounded border font-mono uppercase tracking-widest ${type === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                From
              </label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full bg-background border border-border rounded-md p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                To
              </label>
              <input
                type="date"
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full bg-background border border-border rounded-md p-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full h-20 resize-none bg-background border border-border rounded-md p-2.5 text-sm outline-none focus:border-primary"
              placeholder="Be specific. Helps your manager."
            />
          </div>
          <button
            onClick={() => {
              applyLeave({
                employeeId: actor.id,
                type,
                startDate: start,
                endDate: end,
                reason: reason.trim(),
              });
              toast.success("Leave submitted", { description: "Your manager has been notified." });
              onClose();
            }}
            disabled={!ok}
            className="w-full bg-primary text-primary-foreground rounded-md py-2.5 font-medium text-sm disabled:opacity-40 hover:bg-primary/90"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
