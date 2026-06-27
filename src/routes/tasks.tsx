import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useTasks,
  setStatus,
  createTask,
  priorityRank,
  subtaskProgress,
  totalSpentMs,
  formatDuration,
  activeTimer,
} from "@/lib/task-store";
import { useAttendanceState } from "@/hooks/useAttendance";
import { type AppTask, type TaskPriority, type TaskStatus, type Employee } from "@/types/hr";
import { getRoster } from "@/lib/roster";
import { Avatar } from "@/components/Avatar";
import { TaskDetailSheet } from "@/components/TaskDetailSheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  X,
  Filter,
  MessageSquare,
  Paperclip,
  ListChecks,
} from "lucide-react";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Tasks error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

const COLUMNS: { id: TaskStatus; title: string; tone: string }[] = [
  { id: "todo", title: "To do", tone: "border-muted-foreground/30" },
  { id: "doing", title: "Doing", tone: "border-info/40" },
  { id: "blocked", title: "Blocked", tone: "border-destructive/40" },
  { id: "done", title: "Done", tone: "border-success/40" },
];

const PRI_COLOR: Record<TaskPriority, string> = {
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  med: "bg-info/15 text-info border-info/30",
  low: "bg-muted text-muted-foreground border-border",
};

function timeUntil(ts: number) {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  if (m < 60) return diff < 0 ? `${m}m late` : `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return diff < 0 ? `${h}h late` : `in ${h}h`;
  const d = Math.round(h / 24);
  return diff < 0 ? `${d}d late` : `in ${d}d`;
}

function TasksPage() {
  const { actor, employees } = useAttendanceState();
  const tasks = useTasks();
  const [scope, setScope] = useState<"mine" | "team" | "all">("mine");
  const [draftOpen, setDraftOpen] = useState(false);
  const [activeCol, setActiveCol] = useState<TaskStatus>("todo");
  const [openId, setOpenId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);

  const me = getRoster().find((e) => e.id === actor.id) ?? (actor as unknown as Employee);
  const [hideTasks, setHideTasks] = useState(me?.hideTasks ?? false);

  usePageTour("tasks_tab_tour", [
    {
      popover: {
        title: "Tasks Board",
        description: "Welcome to your task board. Here you can track everything you need to do.",
        side: "over",
        align: "center",
      },
    },
    {
      element: "#tour-tasks-columns",
      popover: { title: "Task Columns", description: "Your tasks are organized by status: To do, Doing, Blocked, and Done.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-tasks-filters",
      popover: { title: "Filters & Scope", description: "Filter tasks by priority, or view your team's tasks if you are a manager.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-tasks-hide-switch",
      popover: { title: "Privacy", description: "As an employee, you can choose to hide your personal tasks from your peers.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-tasks-new",
      popover: {
        title: "Add a Task",
        description:
          "Click here to quickly create a new task. You can assign it to yourself or nudge a teammate.",
        side: "bottom",
        align: "end",
      },
    },
  ]);

  useEffect(() => {
    if (me !== undefined) {
      setHideTasks(me?.hideTasks ?? false);
    }
  }, [me?.hideTasks]);

  const toggleHideTasks = async () => {
    if (!me || isUpdatingShare) return;
    const next = !hideTasks;
    setHideTasks(next);
    setIsUpdatingShare(true);
    try {
      await api.patch(`/employees/${me.id}`, { hideTasks: next });
      const idx = getRoster().findIndex((x) => x.id === me.id);
      if (idx >= 0) {
        getRoster()[idx].hideTasks = next;
      }
      toast.success(next ? "Tasks are now hidden from peers" : "Tasks are visible to peers");
    } catch (e) {
      setHideTasks(!next);
      toast.error("Failed to update task visibility");
    } finally {
      setIsUpdatingShare(false);
    }
  };

  const visible = useMemo(() => {
    let list = tasks.filter((t) => {
      if (t.relatedTo === "Admin Check-In") return false;
      if (t.assigneeId === actor.id || t.assignedById === actor.id) return true;
      if (["admin", "hr", "manager"].includes(actor.appRole)) return true;

      const e = getRoster().find((x) => x.id === t.assigneeId);
      if (!e) return false;
      if (e.hideTasks === true) return false;

      return true;
    });

    if (scope === "mine") {
      list = list.filter((t) => t.assigneeId === actor.id);
    } else if (scope === "team") {
      list = list.filter((t) => {
        if (t.assigneeId === actor.id) return false; // Exclude own tasks from team view
        if (t.assignedById === actor.id) return true;
        const e = getRoster().find((x) => x.id === t.assigneeId);
        return e && (e.team === actor.team || e.managerId === actor.id);
      });
    } else if (scope === "all") {
      if (!["admin", "hr", "manager"].includes(actor.appRole)) {
        list = list.filter((t) => {
          const e = getRoster().find((x) => x.id === t.assigneeId);
          return !(e && e.hideTasks);
        });
      }
    }

    if (priorityFilter !== "all") {
      list = list.filter((t) => t.priority === priorityFilter);
    }
    return [...list].sort(
      (a, b) => priorityRank(b.priority) - priorityRank(a.priority) || a.dueAt - b.dueAt,
    );
  }, [tasks, scope, actor.id, actor.team, actor.appRole, priorityFilter]);

  const counts = useMemo(
    () => ({
      todo: visible.filter((t) => t.status === "todo").length,
      doing: visible.filter((t) => t.status === "doing").length,
      blocked: visible.filter((t) => t.status === "blocked").length,
      done: visible.filter((t) => t.status === "done").length,
    }),
    [visible],
  );

  function changeStatus(t: AppTask, status: TaskStatus) {
    setStatus(t.id, status, actor.id);
    if (status === "done")
      toast.success(`Done — ${t.title}`, { description: "Nice. Logged to your scorecard." });
    else if (status === "doing") toast(`In progress — ${t.title}`);
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
      <header className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
            Today's Mission
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">Move cards. Ship work. Score points.</p>
        </div>
        <button
          id="tour-tasks-new"
          onClick={() => {
            setActiveCol("todo");
            setDraftOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New task
        </button>
      </header>

      <div id="tour-tasks-filters" className="mb-4 flex items-center gap-2 text-xs flex-wrap">
        <div className="w-[140px]">
          <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val as TaskPriority | "all")}>
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="med">Med</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-4 w-px bg-border mx-1" />
        {(["mine", "team", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-3 py-1.5 rounded-full border font-medium transition-colors ${
              scope === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {s === "mine" ? "My tasks" : s === "team" ? "My team" : "Everyone"}
          </button>
        ))}
        {actor.appRole === "employee" && (
          <div id="tour-tasks-hide-switch" className="flex items-center gap-2 ml-4">
            <Switch
              checked={hideTasks}
              onCheckedChange={toggleHideTasks}
              disabled={isUpdatingShare}
            />
            <span className="text-muted-foreground">Hide tasks from peers</span>
          </div>
        )}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {counts.todo} todo · {counts.doing} doing · {counts.blocked} blocked · {counts.done} done
        </span>
      </div>

      {/* Mobile: column tabs */}
      <div className="md:hidden mb-3 grid grid-cols-4 gap-1 bg-secondary p-1 rounded-md">
        {COLUMNS.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCol(c.id)}
            className={`text-xs font-medium py-1.5 rounded ${activeCol === c.id ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            {c.title}{" "}
            <span className="font-mono text-[10px] text-muted-foreground">
              ({counts[c.id as "todo" | "doing" | "blocked" | "done"]})
            </span>
          </button>
        ))}
      </div>

      <div id="tour-tasks-columns" className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = visible.filter((t) => t.status === col.id);
          const visibleOnMobile = activeCol === col.id;
          return (
            <div
              key={col.id}
              className={`${visibleOnMobile ? "" : "hidden md:block"} rounded-2xl bg-card border-t-2 ${col.tone} border-x border-b border-border p-3 min-h-[200px]`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  {col.id === "todo" && <Circle className="h-4 w-4 text-muted-foreground" />}
                  {col.id === "doing" && <Loader2 className="h-4 w-4 text-info" />}
                  {col.id === "blocked" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {col.id === "done" && <CheckCircle2 className="h-4 w-4 text-success" />}
                  <h2 className="font-display font-semibold text-sm">{col.title}</h2>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setActiveCol(col.id);
                    setDraftOpen(true);
                  }}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground"
                  title="Add"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {colTasks.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
                    Nothing here.
                  </div>
                )}
                {colTasks.map((t) => {
                  const overdue = t.status !== "done" && t.dueAt < Date.now();
                  const assignee = getRoster().find((e) => e.id === t.assigneeId);
                  const prog = subtaskProgress(t);
                  const spent = totalSpentMs(t);
                  const running = !!activeTimer(t);
                  const commentCount = t.comments?.length ?? 0;
                  const linkCount = t.links?.length ?? 0;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setOpenId(t.id)}
                      className="bg-background rounded-lg border border-border p-3 hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="font-medium text-sm leading-snug flex-1 min-w-0">
                          {t.title}
                        </div>
                        <span
                          className={`text-[9px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border ${PRI_COLOR[t.priority]} shrink-0`}
                        >
                          {t.priority}
                        </span>
                      </div>
                      {t.relatedTo && (
                        <div className="text-[11px] text-muted-foreground mb-2 truncate">
                          {t.relatedTo}
                        </div>
                      )}
                      {prog.total > 0 && (
                        <div className="mb-2">
                          <div className="h-1 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full bg-success transition-all"
                              style={{ width: `${prog.pct}%` }}
                            />
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-1">
                            {prog.done}/{prog.total} steps
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {assignee && <Avatar id={assignee.id} size={20} />}
                          <span className="text-[11px] text-muted-foreground truncate">
                            {assignee?.name.split(" ")[0]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                          {commentCount > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <MessageSquare className="h-3 w-3" />
                              {commentCount}
                            </span>
                          )}
                          {linkCount > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <Paperclip className="h-3 w-3" />
                              {linkCount}
                            </span>
                          )}
                          {(spent > 0 || running) && (
                            <span
                              className={`inline-flex items-center gap-0.5 ${running ? "text-info" : ""}`}
                            >
                              {running ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              {formatDuration(spent)}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}
                          >
                            {overdue ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {timeUntil(t.dueAt)}
                          </span>
                        </div>
                      </div>
                      {col.id !== "done" && t.assigneeId === actor.id && (
                        <div className="flex gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
                          {col.id !== "todo" && (
                            <button
                              onClick={() => changeStatus(t, "todo")}
                              className="flex-1 text-[10px] py-1 rounded border border-border hover:bg-secondary"
                            >
                              To do
                            </button>
                          )}
                          {col.id !== "doing" && (
                            <button
                              onClick={() => changeStatus(t, "doing")}
                              className="flex-1 text-[10px] py-1 rounded border border-info/40 text-info hover:bg-info/10"
                            >
                              Start
                            </button>
                          )}
                          <button
                            onClick={() => changeStatus(t, "done")}
                            className="flex-1 text-[10px] py-1 rounded border border-success/40 text-success hover:bg-success/10"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {draftOpen && (
        <NewTaskModal
          defaultStatus={activeCol}
          actorId={actor.id}
          onClose={() => setDraftOpen(false)}
          onCreate={(input) => {
            const t = createTask({ ...input, assignedById: actor.id });
            toast.success(
              `Task assigned to ${
                getRoster()
                  .find((e) => e.id === t.assigneeId)
                  ?.name.split(" ")[0]
              }`,
              {
                description: "Nudge sent to their inbox.",
              },
            );
            setDraftOpen(false);
          }}
        />
      )}

      <TaskDetailSheet taskId={openId} actorId={actor.id} onClose={() => setOpenId(null)} />
    </div>
  );
}

function NewTaskModal({
  defaultStatus,
  actorId,
  onClose,
  onCreate,
}: {
  defaultStatus: TaskStatus;
  actorId: string;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    assigneeId: string;
    priority: TaskPriority;
    dueAt: number;
    status: TaskStatus;
    relatedTo?: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(actorId);
  const [priority, setPriority] = useState<TaskPriority>("med");
  const [hours, setHours] = useState(4);
  const [related, setRelated] = useState("");

  const ok = title.trim().length >= 3;

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
          <div>
            <div className="font-display font-semibold text-base">New task</div>
            <div className="text-xs text-muted-foreground">Clear, dated, assigned.</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto pb-6">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="mt-1 w-full bg-background border border-border rounded-md p-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Assign to
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 w-full bg-background border border-border rounded-md p-2.5 text-sm outline-none focus:border-primary"
            >
              {getRoster().map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.role}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Priority
              </label>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {(["low", "med", "high", "urgent"] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`text-[10px] py-2 rounded border uppercase tracking-widest font-mono ${priority === p ? PRI_COLOR[p] : "border-border text-muted-foreground"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Due in (hrs)
              </label>
              <input
                type="number"
                min={1}
                value={hours}
                onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full bg-background border border-border rounded-md p-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Related to (optional)
            </label>
            <input
              value={related}
              onChange={(e) => setRelated(e.target.value)}
              placeholder="Lead #1283, Tour @ 4pm…"
              className="mt-1 w-full bg-background border border-border rounded-md p-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() =>
              ok &&
              onCreate({
                title: title.trim(),
                assigneeId,
                priority,
                dueAt: Date.now() + hours * 3600_000,
                status: defaultStatus,
                relatedTo: related.trim() || undefined,
              })
            }
            disabled={!ok}
            className="w-full bg-primary text-primary-foreground rounded-md py-2.5 font-medium text-sm disabled:opacity-40 hover:bg-primary/90"
          >
            Create task
          </button>
        </div>
      </div>
    </div>
  );
}
