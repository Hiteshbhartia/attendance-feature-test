import { useEffect, useMemo, useState } from "react";
import {
  X,
  CheckCircle2,
  Circle,
  Plus,
  Play,
  Square,
  Paperclip,
  Link2,
  MessageSquare,
  Activity,
  Clock,
  AlertTriangle,
  Trash2,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { type AppTask, type TaskPriority, type TaskStatus } from "@/types/hr";
import { getRoster } from "@/lib/roster";
import {
  activeTimer,
  addComment,
  addLink,
  addSubtask,
  formatDuration,
  removeLink,
  removeSubtask,
  setStatus,
  startTimer,
  stopTimer,
  subtaskProgress,
  toggleSubtask,
  totalSpentMs,
  useTasks,
} from "@/lib/task-store";
import { Avatar } from "@/components/Avatar";

type Tab = "checklist" | "comments" | "activity" | "files";

const PRI_COLOR: Record<TaskPriority, string> = {
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  med: "bg-info/15 text-info border-info/30",
  low: "bg-muted text-muted-foreground border-border",
};

function relTime(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.round(d / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

function dueLabel(ts: number, status: TaskStatus): { text: string; tone: string } {
  if (status === "done") return { text: "Done", tone: "text-success" };
  const diff = ts - Date.now();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60_000);
  let text = "";
  if (m < 60) text = overdue ? `${m}m late` : `in ${m}m`;
  else {
    const h = Math.round(m / 60);
    if (h < 24) text = overdue ? `${h}h late` : `in ${h}h`;
    else {
      const dys = Math.round(h / 24);
      text = overdue ? `${dys}d late` : `in ${dys}d`;
    }
  }
  return { text, tone: overdue ? "text-destructive" : "text-muted-foreground" };
}

export function TaskDetailSheet({
  taskId,
  actorId,
  onClose,
}: {
  taskId: string | null;
  actorId: string;
  onClose: () => void;
}) {
  const tasks = useTasks();
  const task = useMemo(() => tasks.find((t) => t.id === taskId), [tasks, taskId]);
  const [tab, setTab] = useState<Tab>("checklist");
  const [newSub, setNewSub] = useState("");
  const [newComment, setNewComment] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [, force] = useState(0);

  // Live timer tick
  useEffect(() => {
    if (!task) return;
    if (!activeTimer(task)) return;
    const i = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, [task]);

  // Lock body scroll when open
  useEffect(() => {
    if (!taskId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [taskId]);

  if (!taskId || !task) return null;

  const assignee = getRoster().find((e) => e.id === task.assigneeId);
  const assigner = getRoster().find((e) => e.id === task.assignedById);
  const prog = subtaskProgress(task);
  const timer = activeTimer(task);
  const spent = totalSpentMs(task);
  const due = dueLabel(task.dueAt, task.status);

  function changeStatus(s: TaskStatus) {
    setStatus(task!.id, s, actorId);
    if (s === "done") toast.success(`Closed — ${task!.title}`);
  }

  return (
    <div
      className="fixed inset-0 z-[110] bg-sidebar/60 backdrop-blur-sm flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-card border-t border-border md:border md:rounded-2xl shadow-2xl w-full md:max-w-2xl max-h-[92vh] md:max-h-[85vh] flex flex-col rounded-t-2xl animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="md:hidden pt-2 pb-1 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="px-4 md:px-6 pt-2 pb-3 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`text-[9px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border ${PRI_COLOR[task.priority]}`}
                >
                  {task.priority}
                </span>
                {task.relatedTo && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    {task.relatedTo}
                  </span>
                )}
              </div>
              <h2 className="font-display text-lg md:text-xl font-semibold leading-tight">
                {task.title}
              </h2>
              {task.description && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-snug">
                  {task.description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Meta strip */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
            {assignee && (
              <div className="flex items-center gap-1.5">
                <Avatar id={assignee.id} size={18} />
                <span className="text-muted-foreground">Assignee</span>
                <span className="font-medium">{assignee.name.split(" ")[0]}</span>
              </div>
            )}
            {assigner && assigner.id !== assignee?.id && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span>by {assigner.name.split(" ")[0]}</span>
              </div>
            )}
            <div className={`flex items-center gap-1 font-mono ${due.tone}`}>
              {due.tone.includes("destructive") ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {due.text}
            </div>
            {(spent > 0 || timer) && (
              <div className="flex items-center gap-1 font-mono text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {formatDuration(spent)}
                  {task.estimateMin ? ` / ${formatDuration(task.estimateMin * 60_000)}` : ""}
                </span>
                {timer && (
                  <span className="ml-1 inline-flex items-center gap-1 text-info">
                    <Loader2 className="h-3 w-3 animate-spin" /> running
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Progress bar */}
          {prog.total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                <span>Checklist</span>
                <span>
                  {prog.done}/{prog.total} · {prog.pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-success transition-all"
                  style={{ width: `${prog.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-2 md:px-4 pt-2 border-b border-border">
          <div className="flex gap-1 overflow-x-auto">
            {(
              [
                ["checklist", "Checklist", prog.total],
                ["comments", "Comments", task.comments?.length ?? 0],
                ["files", "Files", task.links?.length ?? 0],
                ["activity", "Activity", task.activity?.length ?? 0],
              ] as Array<[Tab, string, number]>
            ).map(([id, label, count]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-2 text-xs font-medium rounded-t-md whitespace-nowrap transition-colors ${
                  tab === id
                    ? "bg-background text-foreground border-x border-t border-border -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className="ml-1.5 font-mono text-[10px] opacity-60">{count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {tab === "checklist" && (
            <div className="space-y-2">
              {(task.subtasks ?? []).length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                  No subtasks yet. Add the first step below.
                </div>
              )}
              {(task.subtasks ?? []).map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-3 px-3 py-3 rounded-lg bg-background border border-border active:scale-[0.99] transition-transform"
                >
                  <button
                    onClick={() => toggleSubtask(task.id, s.id, actorId)}
                    className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-secondary"
                    aria-label={s.done ? "Uncheck" : "Check"}
                  >
                    {s.done ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <span
                    className={`flex-1 text-sm ${s.done ? "line-through text-muted-foreground" : ""}`}
                  >
                    {s.title}
                  </span>
                  <button
                    onClick={() => removeSubtask(task.id, s.id, actorId)}
                    className="opacity-0 group-hover:opacity-100 md:transition-opacity h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "comments" && (
            <div className="space-y-3">
              {(task.comments ?? []).length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                  No comments yet.
                </div>
              )}
              {(task.comments ?? []).map((c) => {
                const author = getRoster().find((e) => e.id === c.authorId);
                return (
                  <div key={c.id} className="flex gap-2.5">
                    {author && <Avatar id={author.id} size={28} />}
                    <div className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-medium truncate">
                          {author?.name ?? "Unknown"}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {relTime(c.ts)}
                        </span>
                      </div>
                      <p className="text-sm leading-snug whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "files" && (
            <div className="space-y-2">
              {(task.links ?? []).length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                  No links or attachments.
                </div>
              )}
              {(task.links ?? []).map((l) => (
                <div
                  key={l.id}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background border border-border"
                >
                  <div className="h-8 w-8 rounded-md bg-secondary inline-flex items-center justify-center shrink-0">
                    {l.kind === "file" ? (
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{l.label}</div>
                    {l.url && (
                      <div className="text-[11px] text-muted-foreground truncate">{l.url}</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeLink(task.id, l.id, actorId)}
                    className="opacity-0 group-hover:opacity-100 md:transition-opacity h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-1 gap-2 pt-2">
                <input
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Label (e.g. Lead profile)"
                  className="bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://… (optional)"
                    className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => {
                      if (!linkLabel.trim()) return;
                      addLink(
                        task.id,
                        {
                          label: linkLabel.trim(),
                          url: linkUrl.trim() || undefined,
                          kind: linkUrl.trim() ? "url" : "doc",
                        },
                        actorId,
                      );
                      setLinkLabel("");
                      setLinkUrl("");
                      toast("Link added");
                    }}
                    className="px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "activity" && (
            <div className="space-y-2">
              {(task.activity ?? []).length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                  No activity yet.
                </div>
              )}
              {[...(task.activity ?? [])].reverse().map((a) => {
                const author = getRoster().find((e) => e.id === a.byId);
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-background border border-border"
                  >
                    <Activity className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs">
                        <span className="font-medium">
                          {author?.name.split(" ")[0] ?? "Someone"}
                        </span>
                        <span className="text-muted-foreground"> · {a.detail}</span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {relTime(a.ts)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky bottom action bar */}
        <div className="border-t border-border bg-card px-3 md:px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] space-y-2">
          {tab === "checklist" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSub.trim()) return;
                addSubtask(task.id, newSub, actorId);
                setNewSub("");
              }}
              className="flex gap-2"
            >
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                placeholder="Add a step…"
                className="flex-1 bg-background border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!newSub.trim()}
                className="h-10 w-10 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Add subtask"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>
          )}

          {tab === "comments" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newComment.trim()) return;
                addComment(task.id, actorId, newComment);
                setNewComment("");
              }}
              className="flex gap-2"
            >
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment…"
                className="flex-1 bg-background border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="h-10 w-10 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* Always-visible action row — assignee only */}
          {actorId === task.assigneeId ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => (timer ? stopTimer(task.id, actorId) : startTimer(task.id, actorId))}
                className={`h-10 px-3 inline-flex items-center gap-1.5 rounded-md border text-xs font-medium ${
                  timer
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : "bg-info/10 text-info border-info/30"
                }`}
              >
                {timer ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {timer ? "Stop" : "Start"}
              </button>
              <div className="flex-1 grid grid-cols-3 gap-1">
                {(["todo", "doing", "done"] as TaskStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    className={`h-10 text-[11px] font-medium rounded-md border transition-colors ${
                      task.status === s
                        ? s === "done"
                          ? "bg-success text-success-foreground border-success"
                          : s === "doing"
                            ? "bg-info text-info-foreground border-info"
                            : "bg-secondary text-foreground border-border"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {s === "todo" ? "To do" : s === "doing" ? "Doing" : "Done"}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-1 py-1.5">
              <span className="text-xs text-muted-foreground italic">
                Only {assignee?.name.split(" ")[0] ?? "the assignee"} can update this task.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
