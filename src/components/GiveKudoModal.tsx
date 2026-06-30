import { useState } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useRoster } from "@/hooks/useRoster";
import { KUDO_TAGS, giveKudo, tagColor } from "@/lib/kudos-store";
import { useAttendanceState } from "@/hooks/useAttendance";
import { Avatar } from "./Avatar";
import { X } from "lucide-react";
import type { KudoTag } from "@/types/hr";

interface Props {
  open: boolean;
  onClose: () => void;
  toId?: string; // pre-select recipient
}

export function GiveKudoModal({ open, onClose, toId }: Props) {
  const { actor } = useAttendanceState();
  const roster = useRoster();
  const [recipient, setRecipient] = useState(toId ?? "");
  const [tag, setTag] = useState<KudoTag>("Hustle");
  const [msg, setMsg] = useState("");

  if (!open) return null;

  const others = roster.filter((e) => e.id !== actor.id && e.name !== "Admin");
  const canSend = recipient && msg.trim().length >= 5;

  function send() {
    if (!canSend) return;
    giveKudo(actor.id, recipient, tag, msg.trim());
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    toast.success("Kudo sent — they'll feel it.");
    setMsg("");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-sidebar/50 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-display font-semibold text-lg">Cheer someone on</div>
            <div className="text-xs text-muted-foreground">Make their week. Be specific.</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              To
            </label>
            <div className="mt-1 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {others.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setRecipient(e.id)}
                  className={`flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border text-xs transition-colors ${
                    recipient === e.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border hover:border-primary/40"
                  }`}
                >
                  <Avatar id={e.id} size={20} />
                  <span>{e.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              For
            </label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {KUDO_TAGS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    tag === t
                      ? `${tagColor(t)} ring-2 ring-primary/30`
                      : "bg-secondary border-border hover:border-primary/40 text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Why
            </label>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="One sentence. Specific is best."
              className="mt-1 w-full h-20 resize-none bg-background border border-border rounded-md p-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={send}
            disabled={!canSend}
            className="w-full bg-primary text-primary-foreground rounded-md py-2.5 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            Send the kudo
          </button>
        </div>
      </div>
    </div>
  );
}
