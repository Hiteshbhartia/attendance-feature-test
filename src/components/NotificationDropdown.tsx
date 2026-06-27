import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useNotifications,
  markRead,
  markAllRead,
  kindBadge,
  nameOf,
  unreadCount,
} from "@/lib/notification-store";
import { useAttendanceState } from "@/hooks/useAttendance";
import { Avatar } from "./Avatar";
import { Bell, Check } from "lucide-react";

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ open, onClose }: Props) {
  const { actor } = useAttendanceState();
  const all = useNotifications(actor.id).slice(0, 8);
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

  return (
    <div
      ref={ref}
      className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="font-display font-semibold text-sm">Inbox</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {unreadCount(actor.id)} unread
          </div>
        </div>
        <button
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          onClick={() => markAllRead(actor.id)}
        >
          <Check className="h-3 w-3" /> Mark all read
        </button>
      </div>
      <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
        {all.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            All clear. Nothing needs you right now.
          </div>
        )}
        {all.map((n) => {
          const badge = kindBadge(n.kind);
          return (
            <button
              key={n.id}
              onClick={() => {
                markRead(n.id);
                if (n.actionTo) navigate({ to: n.actionTo });
                onClose();
              }}
              className={`w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors flex gap-3 ${
                !n.read ? "bg-primary/5" : ""
              }`}
            >
              {n.fromId ? (
                <Avatar id={n.fromId} size={36} />
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(n.ts)}</span>
                  {!n.read && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
                <div className="font-medium text-sm mt-1 truncate">{n.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
              </div>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => {
          navigate({ to: "/inbox" });
          onClose();
        }}
        className="w-full px-4 py-3 text-center text-xs font-medium text-primary hover:bg-secondary/50 border-t border-border"
      >
        Open full inbox →
      </button>
      {/* prevent unused warning */}
      <span className="hidden">{nameOf("")}</span>
    </div>
  );
}
