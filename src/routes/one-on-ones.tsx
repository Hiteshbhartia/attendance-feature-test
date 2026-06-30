import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckSquare,
  MessageSquareText,
  Plus,
  Square,
  Sparkles,
  MapPin,
  Video,
} from "lucide-react";
import {
  useOneOnOnes,
  createOneOnOne,
  completeOneOnOne,
  toggleActionItem,
  addActionItem,
  sentimentColor,
} from "@/lib/oneonone-store";
import { Avatar } from "@/components/Avatar";
import { type OneOnOne, type OneOnOneSentiment } from "@/types/hr";
import { getRoster } from "@/lib/roster";
import { useAttendanceState } from "@/hooks/useAttendance";
import { RoleGate } from "@/components/RoleGate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/one-on-ones")({
  head: () => ({
    meta: [
      { title: "Schedule 1:1 — Gharpayy Arena" },
      {
        name: "description",
        content:
          "Run sharper 1:1s. Track agenda, notes, sentiment, and action items between managers and reports.",
      },
    ],
  }),
  component: OneOnOnesPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

function timeAgo(ts: number) {
  const d = ts - Date.now();
  const future = d > 0;
  const abs = Math.abs(d);
  const m = Math.floor(abs / 60000);
  if (m < 60) return future ? `in ${m}m` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return future ? `in ${h}h` : `${h}h ago`;
  const dd = Math.floor(h / 24);
  return future ? `in ${dd}d` : `${dd}d ago`;
}

function OneOnOnesPage() {
  return (
    <RoleGate allow={["leadership", "zone_leader", "hr", "leader", "recruiter"]}>
      <Body />
    </RoleGate>
  );
}

function Body() {
  usePageTour("one_on_ones_tour", [
    {
      popover: {
        title: "Schedule 1:1",
        description: "Welcome to the Coaching Loop. This is where you can schedule, track, and document your 1:1 meetings.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-1on1-schedule",
      popover: { title: "Schedule a 1:1", description: "Click here to schedule a new 1:1 with a teammate.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-1on1-tabs",
      popover: { title: "Meeting History", description: "Filter between your upcoming scheduled 1:1s and past completed meetings.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-1on1-list",
      popover: { title: "Your 1:1s", description: "All your 1:1s appear here. Click on any card to view the agenda, take notes, or assign action items.", side: "top", align: "start" }
    }
  ]);

  const { actor } = useAttendanceState();
  const all = useOneOnOnes();
  const mine = useMemo(
    () => all.filter((o) => o.managerId === actor.id || o.reportId === actor.id),
    [all, actor.id],
  );
  const [tab, setTab] = useState<"upcoming" | "past" | "all">("upcoming");
  const [openId, setOpenId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const filtered = useMemo(() => {
    if (tab === "upcoming") return mine.filter((o) => o.status === "scheduled");
    if (tab === "past") return mine.filter((o) => o.status !== "scheduled");
    return mine;
  }, [mine, tab]);

  const opened = openId ? all.find((o) => o.id === openId) : null;

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1100px] mx-auto">
      <header className="mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
            Coaching Loop
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">
            Schedule 1:1
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Agenda · Notes · Sentiment · Action items. The full loop, in writing.
          </p>
        </div>
        <button
          id="tour-1on1-schedule"
          onClick={() => setComposerOpen(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Schedule 1:1
        </button>
      </header>

      <div id="tour-1on1-tabs" className="flex gap-1 mb-4 border-b border-border">
        {(["upcoming", "past", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t} (
            {t === "upcoming"
              ? mine.filter((o) => o.status === "scheduled").length
              : t === "past"
                ? mine.filter((o) => o.status !== "scheduled").length
                : mine.length}
            )
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <MessageSquareText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <div className="font-display font-semibold text-lg">No 1:1s here yet</div>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule the first one to start the coaching loop.
          </p>
        </div>
      ) : (
        <div id="tour-1on1-list" className="grid gap-3 md:grid-cols-2">
          {filtered.map((o) => (
            <OneOnOneCard key={o.id} o={o} onOpen={() => setOpenId(o.id)} actorId={actor.id} />
          ))}
        </div>
      )}

      {composerOpen && <ComposerModal onClose={() => setComposerOpen(false)} actorId={actor.id} />}
      {opened && <DetailModal o={opened} onClose={() => setOpenId(null)} actorId={actor.id} />}
    </div>
  );
}

function OneOnOneCard({
  o,
  onOpen,
  actorId,
}: {
  o: OneOnOne;
  onOpen: () => void;
  actorId: string;
}) {
  const manager = getRoster().find((e) => e.id === o.managerId);
  const report = getRoster().find((e) => e.id === o.reportId);
  const other = actorId === o.managerId ? report : manager;
  const role = actorId === o.managerId ? "Coaching" : "1:1 with manager";
  const openItems = o.actionItems.filter((a) => !a.done).length;

  return (
    <button
      onClick={onOpen}
      className="text-left rounded-2xl bg-card border border-border p-4 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Avatar id={other?.id} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{other?.name}</span>
            <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
              {role}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <CalendarClock className="h-3 w-3" />
            {new Date(o.scheduledAt).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            <span className="text-muted-foreground/60">·</span>
            <span>{timeAgo(o.scheduledAt)}</span>
            {o.meetingType === "remote" ? (
              <>
                <span className="text-muted-foreground/60">·</span>
                <Video className="h-3 w-3" />
                <span>Remote</span>
              </>
            ) : o.meetingType === "in-person" ? (
              <>
                <span className="text-muted-foreground/60">·</span>
                <MapPin className="h-3 w-3" />
                <span>In-person</span>
              </>
            ) : null}
          </div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border ${sentimentColor(o.sentiment)}`}
        >
          {o.status === "scheduled" ? "Scheduled" : (o.sentiment ?? "Done")}
        </span>
      </div>

      {o.agenda && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2 whitespace-pre-line">
          {o.agenda}
        </p>
      )}

      {(o.actionItems.length > 0 || o.notes) && (
        <div className="mt-3 flex items-center gap-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {o.notes && (
            <span className="inline-flex items-center gap-1">
              <MessageSquareText className="h-3 w-3" /> Notes
            </span>
          )}
          {o.actionItems.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="h-3 w-3" /> {o.actionItems.length - openItems}/
              {o.actionItems.length} actions
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function ComposerModal({ onClose, actorId }: { onClose: () => void; actorId: string }) {
  const [reportId, setReportId] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 24);
    return d.toISOString().slice(0, 16);
  });
  const [meetingType, setMeetingType] = useState<"in-person" | "remote">("in-person");
  const [meetingLink, setMeetingLink] = useState("");
  const [agenda, setAgenda] = useState("");

  const reports = getRoster().filter(
    (e) => e.id !== actorId && e.role !== "Admin" && e.appRole !== "admin"
  );

  function submit() {
    if (!reportId) return;
    createOneOnOne({
      managerId: actorId,
      reportId,
      scheduledAt: new Date(when).getTime(),
      agenda,
      meetingType,
      meetingLink: meetingType === "remote" ? meetingLink : undefined,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold mb-3">Schedule 1:1</h2>
        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          With
        </label>
        <Select value={reportId} onValueChange={setReportId}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Pick a teammate" />
          </SelectTrigger>
          <SelectContent>
            {reports.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} · {e.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-3 block">
          When
        </label>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mt-1 w-full h-10 px-3 rounded-md bg-background border border-input text-sm"
        />

        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-3 block">
          Meeting Type
        </label>
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => setMeetingType("in-person")}
            className={`flex-1 py-2 rounded-md text-sm font-medium border ${meetingType === "in-person" ? "bg-primary/10 border-primary text-primary" : "border-input hover:bg-secondary"}`}
          >
            In-Person
          </button>
          <button
            onClick={() => setMeetingType("remote")}
            className={`flex-1 py-2 rounded-md text-sm font-medium border ${meetingType === "remote" ? "bg-primary/10 border-primary text-primary" : "border-input hover:bg-secondary"}`}
          >
            Remote
          </button>
        </div>

        {meetingType === "remote" && (
          <>
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-3 block">
              Meeting Link
            </label>
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="e.g. Google Meet or Zoom link"
              className="mt-1 w-full h-10 px-3 rounded-md bg-background border border-input text-sm"
            />
          </>
        )}

        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-3 block">
          Agenda (optional)
        </label>
        <textarea
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          placeholder={`1) What's working\n2) What's blocked\n3) One thing I can unblock`}
          className="mt-1 w-full min-h-[110px] p-3 rounded-md bg-background border border-input text-sm resize-y"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!reportId}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({
  o,
  onClose,
  actorId,
}: {
  o: OneOnOne;
  onClose: () => void;
  actorId: string;
}) {
  const manager = getRoster().find((e) => e.id === o.managerId);
  const report = getRoster().find((e) => e.id === o.reportId);
  const isManager = actorId === o.managerId;
  const [notes, setNotes] = useState(o.notes);
  const [privateNotes, setPrivateNotes] = useState(o.privateNotes ?? "");
  const [sentiment, setSentiment] = useState<OneOnOneSentiment>(o.sentiment ?? "green");
  const [newAction, setNewAction] = useState("");

  function saveAndComplete() {
    completeOneOnOne(o.id, sentiment, notes, privateNotes);
    onClose();
  }

  function addAction() {
    if (!newAction.trim()) return;
    addActionItem(o.id, { title: newAction.trim(), ownerId: actorId, done: false });
    setNewAction("");
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <Avatar id={isManager ? report?.id : manager?.id} size={44} />
          <div className="flex-1">
            <div className="font-display font-semibold text-lg">
              {manager?.name} ↔ {report?.name}
            </div>
            <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
              {new Date(o.scheduledAt).toLocaleString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" · "}
              {o.durationMin} min
              {o.meetingType === "remote" ? (
                <>
                  {" · "}Remote
                </>
              ) : o.meetingType === "in-person" ? (
                <>
                  {" · "}In-person
                </>
              ) : null}
            </div>
            {o.meetingType === "remote" && o.meetingLink && (
              <a
                href={o.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex mt-1 items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                <Video className="h-3 w-3" /> Join Meeting
              </a>
            )}
          </div>
          <span
            className={`text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border ${sentimentColor(o.sentiment)}`}
          >
            {o.status}
          </span>
        </div>

        {o.agenda && (
          <section className="mb-4">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Agenda
            </div>
            <div className="rounded-md bg-muted/50 border border-border p-3 text-sm whitespace-pre-line">
              {o.agenda}
            </div>
          </section>
        )}

        <section className="mb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Shared notes
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did we actually decide? Be specific."
            className="w-full min-h-[110px] p-3 rounded-md bg-background border border-input text-sm resize-y"
          />
        </section>

        {isManager && (
          <section className="mb-4">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5">
              Private notes{" "}
              <span className="text-[9px] bg-warning/15 text-warning border border-warning/30 px-1 rounded">
                manager only
              </span>
            </div>
            <textarea
              value={privateNotes}
              onChange={(e) => setPrivateNotes(e.target.value)}
              placeholder="Promotability, risks, calls to make later."
              className="w-full min-h-[80px] p-3 rounded-md bg-background border border-input text-sm resize-y"
            />
          </section>
        )}

        <section className="mb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Sentiment
          </div>
          <div className="flex gap-2">
            {(["green", "amber", "red"] as OneOnOneSentiment[]).map((s) => (
              <button
                key={s}
                onClick={() => setSentiment(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border capitalize ${
                  sentiment === s
                    ? sentimentColor(s)
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Action items
          </div>
          <div className="space-y-1.5">
            {o.actionItems.map((a) => (
              <button
                key={a.id}
                onClick={() => toggleActionItem(o.id, a.id)}
                className="w-full flex items-center gap-2 text-left text-sm py-1.5 px-2 rounded hover:bg-secondary"
              >
                {a.done ? (
                  <CheckSquare className="h-4 w-4 text-success" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={a.done ? "line-through text-muted-foreground" : ""}>
                  {a.title}
                </span>
                <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {
                    getRoster()
                      .find((e) => e.id === a.ownerId)
                      ?.name.split(" ")[0]
                  }
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAction()}
              placeholder="Add an action item…"
              className="flex-1 h-9 px-3 rounded-md bg-background border border-input text-sm"
            />
            <button
              onClick={addAction}
              className="px-3 h-9 rounded-md bg-secondary text-sm font-medium"
            >
              Add
            </button>
          </div>
        </section>

        <div className="flex justify-between items-center gap-2 pt-3 border-t border-border">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> Coaching brief coming soon
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-secondary">
              Close
            </button>
            {isManager && o.status === "scheduled" && (
              <button
                onClick={saveAndComplete}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium"
              >
                Save & complete
              </button>
            )}
            {isManager && o.status !== "scheduled" && (
              <button
                onClick={() => {
                  completeOneOnOne(o.id, sentiment, notes, privateNotes);
                  onClose();
                }}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium"
              >
                Save changes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
