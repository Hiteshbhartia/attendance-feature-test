import { useSyncExternalStore, useMemo } from "react";
import { createApiListStore } from "./api-list-store";
import type { ChatMessage, ChatThread } from "@/types/hr";
import { pushNotification } from "./notification-store";
import { getRoster } from "./roster";
import { notifyChat } from "./socket-client";

const messageStore = createApiListStore<ChatMessage>({
  legacyKey: "gp_chat_messages_v1",
  apiPath: "/messages",
  seed: [],
});

const threadStore = createApiListStore<ChatThread>({
  legacyKey: "gp_chat_threads_v1",
  apiPath: "/threads",
  seed: [],
});

export function hydrateMessages() {
  messageStore.hydrateFromApi();
  return threadStore.hydrateFromApi();
}

export function useThreads(actorId: string): ChatThread[] {
  const all = useSyncExternalStore(
    (cb) => threadStore.subscribe(cb),
    () => threadStore.read(),
    threadStore.getServerSnapshot,
  );
  return useMemo(() => {
    return all
      .filter((t) => t.participantIds.includes(actorId))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [all, actorId]);
}

export function useMessages(threadId: string): ChatMessage[] {
  const all = useSyncExternalStore(
    (cb) => messageStore.subscribe(cb),
    () => messageStore.read(),
    messageStore.getServerSnapshot,
  );
  return useMemo(() => {
    return all
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.ts - b.ts);
  }, [all, threadId]);
}

export function findOrCreateThread(actorId: string, targetId: string): ChatThread {
  const threads = threadStore.read();
  const existing = threads.find(
    (t) => t.participantIds.includes(actorId) && t.participantIds.includes(targetId) && t.participantIds.length === 2
  );
  if (existing) return existing;

  const next: ChatThread = {
    id: crypto.randomUUID(),
    participantIds: [actorId, targetId],
    updatedAt: Date.now(),
  };
  // Defer the write to avoid "Cannot update a component while rendering a different component"
  setTimeout(() => {
    threadStore.write([...threads, next]);
  }, 0);
  return next;
}

export function sendMessage(
  fromId: string,
  threadId: string,
  body: string,
  actionType?: ChatMessage["actionType"],
  actionPayload?: ChatMessage["actionPayload"]
) {
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    threadId,
    fromId,
    body,
    ts: Date.now(),
    actionType,
    actionPayload,
  };

  messageStore.write([...messageStore.read(), msg]);

  // Update thread
  const threads = threadStore.read();
  threadStore.write(
    threads.map((t) => (t.id === threadId ? { ...t, updatedAt: msg.ts, lastMessage: body } : t))
  );

  // Notify other participants
  const thread = threads.find((t) => t.id === threadId);
  if (thread) {
    const others = thread.participantIds.filter((id) => id !== fromId);
    for (const toId of others) {
      pushNotification({
        kind: actionType ? "approval" : "mention",
        toId,
        fromId,
        title: actionType === "leave_request" ? "Leave Request" : "New Message",
        body: body.slice(0, 50) + (body.length > 50 ? "..." : ""),
        actionLabel: "View Inbox",
        actionTo: "/inbox",
      });
    }

    // Trigger instant websocket refresh for all other participants
    notifyChat(others);
  }

  return msg;
}
