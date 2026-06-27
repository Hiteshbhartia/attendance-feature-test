import { useSyncExternalStore } from "react";
import { createApiListStore } from "./api-list-store";
import type {
  ActivityKind,
  AppTask,
  TaskActivity,
  TaskComment,
  TaskLink,
  TaskStatus,
  Subtask,
  TimeLog,
} from "@/types/hr";
import { pushNotification, nameOf } from "./notification-store";

const store = createApiListStore<AppTask>({
  legacyKey: "gp_tasks_v2",
  apiPath: "/tasks",
  seed: [],
});

export function ensureTaskSeed() {
  store.ensureSeed();
}

export function hydrateTasks() {
  return store.hydrateFromApi();
}

export function flushTasksSync() {
  return store.flushSync();
}

export function useTasks(): AppTask[] {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.read(),
    store.getServerSnapshot,
  );
}

export function tasksFor(assigneeId: string): AppTask[] {
  return store.read().filter((t) => t.assigneeId === assigneeId && t.relatedTo !== "Admin Check-In");
}

export function tasksAssignedBy(byId: string): AppTask[] {
  return store.read().filter((t) => t.assignedById === byId);
}

export function getTask(id: string): AppTask | undefined {
  return store.read().find((t) => t.id === id);
}

function patch(id: string, fn: (t: AppTask) => AppTask) {
  store.write(store.read().map((t) => (t.id === id ? fn(t) : t)));
}

function logActivity(t: AppTask, byId: string, kind: ActivityKind, detail: string): TaskActivity[] {
  const entry: TaskActivity = { id: crypto.randomUUID(), kind, byId, detail, ts: Date.now() };
  return [...(t.activity ?? []), entry];
}

export function setStatus(id: string, status: TaskStatus, byId?: string) {
  const current = store.read().find((t) => t.id === id);
  if (!current || current.status === status) return;
  patch(id, (t) => ({
    ...t,
    status,
    completedAt: status === "done" ? Date.now() : undefined,
    activity: logActivity(t, byId ?? t.assigneeId, "status", `Moved to ${status}`),
  }));

  if (status === "done") {
    const onTime = current.dueAt >= Date.now();
    const recipients = new Set<string>();
    if (current.assignedById && current.assignedById !== current.assigneeId)
      recipients.add(current.assignedById);
    recipients.add(current.assigneeId);
    for (const toId of recipients) {
      if (current.relatedTo === "Admin Check-In") continue;
      const isOwner = toId === current.assigneeId;
      pushNotification({
        kind: "task",
        toId,
        fromId: current.assigneeId,
        title: isOwner
          ? `Task closed — +${onTime ? 5 : 2} score points`
          : `${nameOf(current.assigneeId)} marked a task done`,
        body: `${current.title}${onTime ? " · on time" : " · late"}`,
        actionLabel: isOwner ? "View scorecard" : "Review task",
        actionTo: isOwner ? "/score" : "/tasks",
      });
    }
  } else if (
    status === "doing" &&
    current.assignedById &&
    current.assignedById !== current.assigneeId &&
    current.relatedTo !== "Admin Check-In"
  ) {
    pushNotification({
      kind: "task",
      toId: current.assignedById,
      fromId: current.assigneeId,
      title: `${nameOf(current.assigneeId)} started a task`,
      body: current.title,
      actionLabel: "Open board",
      actionTo: "/tasks",
    });
  }
}

export function createTask(
  input: Omit<AppTask, "id" | "createdAt" | "status"> & { status?: TaskStatus },
) {
  const next: AppTask = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: input.status ?? "todo",
    subtasks: input.subtasks ?? [],
    comments: input.comments ?? [],
    links: input.links ?? [],
    timeLogs: input.timeLogs ?? [],
    activity: [
      {
        id: crypto.randomUUID(),
        kind: "created",
        byId: input.assignedById,
        detail: "Created task",
        ts: Date.now(),
      },
    ],
  };
  store.write([next, ...store.read()]);
  if (next.assigneeId !== next.assignedById) {
    if (next.relatedTo === "Admin Check-In") {
      pushNotification({
        kind: "task",
        toId: next.assigneeId,
        fromId: next.assignedById,
        title: `${nameOf(next.assignedById)} sent a check-in`,
        body: next.title.replace("Admin Check-In: ", ""),
        actionLabel: "Open Console",
        actionTo: "/console",
      });
    } else {
      pushNotification({
        kind: "task",
        toId: next.assigneeId,
        fromId: next.assignedById,
        title: `${nameOf(next.assignedById)} assigned you a task`,
        body: next.title,
        actionLabel: "Open",
        actionTo: "/tasks",
      });
    }
  }
  return next;
}

export function priorityRank(p: AppTask["priority"]): number {
  return { urgent: 4, high: 3, med: 2, low: 1 }[p];
}

// ---------- Subtasks ----------
export function addSubtask(taskId: string, title: string, byId: string) {
  const sub: Subtask = { id: crypto.randomUUID(), title: title.trim(), done: false };
  if (!sub.title) return;
  patch(taskId, (t) => ({
    ...t,
    subtasks: [...(t.subtasks ?? []), sub],
    activity: logActivity(t, byId, "subtask_add", `Added subtask "${sub.title}"`),
  }));
}

export function toggleSubtask(taskId: string, subId: string, byId: string) {
  patch(taskId, (t) => {
    const subs = (t.subtasks ?? []).map((s) => (s.id === subId ? { ...s, done: !s.done } : s));
    const target = subs.find((s) => s.id === subId);
    return {
      ...t,
      subtasks: subs,
      activity: logActivity(
        t,
        byId,
        "subtask_toggle",
        `${target?.done ? "Checked" : "Unchecked"} "${target?.title}"`,
      ),
    };
  });
}

export function removeSubtask(taskId: string, subId: string, byId: string) {
  patch(taskId, (t) => {
    const target = (t.subtasks ?? []).find((s) => s.id === subId);
    return {
      ...t,
      subtasks: (t.subtasks ?? []).filter((s) => s.id !== subId),
      activity: logActivity(t, byId, "subtask_add", `Removed "${target?.title ?? "subtask"}"`),
    };
  });
}

export function subtaskProgress(t: AppTask): { done: number; total: number; pct: number } {
  const list = t.subtasks ?? [];
  const total = list.length;
  const done = list.filter((s) => s.done).length;
  const pct = total
    ? Math.round((done / total) * 100)
    : t.status === "done"
      ? 100
      : t.status === "doing"
        ? 50
        : 0;
  return { done, total, pct };
}

// ---------- Comments ----------
export function addComment(taskId: string, authorId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const c: TaskComment = { id: crypto.randomUUID(), authorId, body: text, ts: Date.now() };
  patch(taskId, (t) => ({
    ...t,
    comments: [...(t.comments ?? []), c],
    activity: logActivity(t, authorId, "comment", "Commented"),
  }));
  // Notify the other party
  const t2 = store.read().find((x) => x.id === taskId);
  if (t2) {
    const otherId = authorId === t2.assigneeId ? t2.assignedById : t2.assigneeId;
    if (otherId && otherId !== authorId) {
      if (t2.relatedTo === "Admin Check-In") {
        const checkInName = t2.title.replace("Admin Check-In: ", "");
        pushNotification({
          kind: "mention",
          toId: otherId,
          fromId: authorId,
          title: `${nameOf(authorId)} replied to: ${checkInName}`,
          body: text.slice(0, 80),
          actionLabel: "View Response",
          actionTo: "/console",
        });
      } else {
        pushNotification({
          kind: "mention",
          toId: otherId,
          fromId: authorId,
          title: `${nameOf(authorId)} commented on a task`,
          body: text.slice(0, 80),
          actionLabel: "Open task",
          actionTo: "/tasks",
        });
      }
    }
  }
}

// ---------- Links / attachments ----------
export function addLink(taskId: string, link: Omit<TaskLink, "id">, byId: string) {
  const l: TaskLink = { ...link, id: crypto.randomUUID() };
  patch(taskId, (t) => ({
    ...t,
    links: [...(t.links ?? []), l],
    activity: logActivity(
      t,
      byId,
      l.kind === "file" ? "attachment_add" : "link_add",
      `Added ${l.kind === "file" ? "attachment" : "link"} "${l.label}"`,
    ),
  }));
}

export function removeLink(taskId: string, linkId: string, byId: string) {
  patch(taskId, (t) => {
    const target = (t.links ?? []).find((l) => l.id === linkId);
    return {
      ...t,
      links: (t.links ?? []).filter((l) => l.id !== linkId),
      activity: logActivity(t, byId, "link_add", `Removed "${target?.label ?? "link"}"`),
    };
  });
}

// ---------- Time tracking ----------
export function activeTimer(t: AppTask): TimeLog | undefined {
  return (t.timeLogs ?? []).find((l) => !l.endAt);
}

export function startTimer(taskId: string, byId: string) {
  patch(taskId, (t) => {
    if (activeTimer(t)) return t;
    const log: TimeLog = { id: crypto.randomUUID(), byId, startAt: Date.now() };
    return {
      ...t,
      status: t.status === "todo" ? "doing" : t.status,
      timeLogs: [...(t.timeLogs ?? []), log],
      activity: logActivity(t, byId, "timer_start", "Started timer"),
    };
  });
}

export function stopTimer(taskId: string, byId: string) {
  patch(taskId, (t) => {
    const logs = (t.timeLogs ?? []).map((l) => (!l.endAt ? { ...l, endAt: Date.now() } : l));
    return {
      ...t,
      timeLogs: logs,
      activity: logActivity(t, byId, "timer_stop", "Stopped timer"),
    };
  });
}

export function totalSpentMs(t: AppTask): number {
  return (t.timeLogs ?? []).reduce((sum, l) => sum + ((l.endAt ?? Date.now()) - l.startAt), 0);
}

export function formatDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

// ---------- Estimate ----------
export function setEstimate(taskId: string, minutes: number, byId: string) {
  patch(taskId, (t) => ({
    ...t,
    estimateMin: minutes > 0 ? minutes : undefined,
    activity: logActivity(t, byId, "due", `Set estimate to ${minutes}m`),
  }));
}

export function requestTaskReason(taskId: string, requesterId: string) {
  const current = getTask(taskId);
  if (!current) return;
  
  patch(taskId, (t) => ({
    ...t,
    activity: logActivity(t, requesterId, "comment", `Requested reason for delay`),
  }));

  pushNotification({
    kind: "task",
    toId: current.assigneeId,
    fromId: requesterId,
    title: `Reason requested for overdue task`,
    body: `${nameOf(requesterId)} requested an update on: ${current.title}`,
    actionLabel: "Provide update",
    actionTo: "/tasks",
  });
}

export function scheduleOverdueMeeting(assigneeId: string, relatedTaskId: string, requesterId: string) {
  const current = getTask(relatedTaskId);
  if (!current) return;

  const meetingId = crypto.randomUUID();
  const newTask: AppTask = {
    id: meetingId,
    title: `Overdue Review: ${current.title}`,
    description: `Immediate meeting required to discuss overdue task: ${current.title}`,
    assigneeId,
    assignedById: requesterId,
    status: "todo",
    priority: "high",
    dueAt: Date.now() + 1000 * 60 * 60, // Due in 1 hour
    createdAt: Date.now(),
    relatedTo: relatedTaskId,
    source: "manual",
  };

  store.write([...store.read(), newTask]);

  pushNotification({
    kind: "task",
    toId: assigneeId,
    fromId: requesterId,
    title: `Meeting Scheduled`,
    body: `${nameOf(requesterId)} scheduled an urgent review for your overdue task.`,
    actionLabel: "View meeting",
    actionTo: "/tasks",
  });
}
