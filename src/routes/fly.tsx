import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  PlaneTakeoff,
  ArrowUp,
  MessageCircle,
  Sparkles,
  Activity,
  Flame,
  TrendingUp,
  AlertTriangle,
  Phone,
  MapPin,
  Target,
  IndianRupee,
  Send,
  Loader2,
  Trophy,
  Building2,
  Calendar as CalIcon,
  CheckCircle2,
} from "lucide-react";
import { type Employee } from "@/types/hr";
import { getRoster } from "@/lib/roster";
import { useAttendanceState } from "@/hooks/useAttendance";
import { Avatar } from "@/components/Avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDailyUpdates,
  useRetroItems,
  useFeed,
  submitDailyUpdate,
  todayUpdateFor,
  addRetro,
  toggleRetroUpvote,
  addRetroComment,
  postFeed,
  toggleFeedUpvote,
  addFeedComment,
  todayRollup,
  getRawStores,
  type RetroKind,
  type FeedKind,
  type RetroItem,
  type FeedEvent,
} from "@/lib/fly-store";
import { useTasks, createTask, setStatus as setTaskStatus } from "@/lib/task-store";
import { fetchDailyBrief, type SummaryOut } from "@/lib/daily-brief-api";
import { toast } from "sonner";
import { useZoneStore } from "@/lib/zones-store";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/fly")({
  component: FlyPage,
  head: () => ({
    meta: [
      { title: "Fly Board — Core Arena" },
      {
        name: "description",
        content:
          "The daily execution board. Updates, retros, feed, and the day's brief — without the meetings.",
      },
    ],
  }),
});

type Tab = "daily" | "retro" | "feed" | "summary" | "leadership" | "tasks";

const TABS: { id: Tab; label: string; icon: typeof PlaneTakeoff }[] = [
  { id: "daily", label: "Daily Update", icon: CheckCircle2 },
  { id: "retro", label: "Start / Stop / Continue", icon: Activity },
  { id: "feed", label: "Team Feed", icon: Flame },
  { id: "tasks", label: "Action Items", icon: Target },
  { id: "summary", label: "Daily Brief", icon: Sparkles },
  { id: "leadership", label: "Leadership", icon: Trophy },
];

const empName = (id: string) => getRoster().find((e) => e.id === id)?.name ?? "Someone";
const empOf = (id: string): Employee | undefined => getRoster().find((e) => e.id === id);
const ago = (ts: number) => {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

function FlyPage() {
  const { actor } = useAttendanceState();
  const [tab, setTab] = useState<Tab>("daily");

  let steps: any[] = [];
  if (tab === "daily") {
    steps = [
      { element: "#tour-fly-tabs", popover: { title: "Fly Modules", description: "Switch between Daily Updates, the Retro board, Team Feed, Action Items, Summary, and Leadership views.", side: "bottom", align: "start" } },
      { element: "#tour-fly-daily-form", popover: { title: "Your Update", description: "Submit your numbers and updates here to share your execution progress with the team.", side: "right", align: "start" } }
    ];
  } else if (tab === "retro") {
    steps = [
      { element: "#tour-fly-tabs", popover: { title: "Fly Modules", description: "Switch between Daily Updates, the Retro board, Team Feed, Action Items, Summary, and Leadership views.", side: "bottom", align: "start" } },
      { element: "#tour-fly-retro-columns", popover: { title: "Feedback Loop", description: "Add cards to the Start, Stop, or Continue columns to share feedback with the team.", side: "top", align: "start" } }
    ];
  } else if (tab === "feed") {
    steps = [
      { element: "#tour-fly-feed-form", popover: { title: "Post Update", description: "Share a win, flag an issue, or post a hot lead to the entire team.", side: "bottom", align: "start" } },
    ];
  } else if (tab === "tasks") {
    steps = [
      { element: "#tour-fly-tasks-form", popover: { title: "Create Action Item", description: "Assign tasks or blockers to team members directly from the Fly board.", side: "bottom", align: "start" } },
    ];
  } else if (tab === "summary") {
    steps = [
      { element: "#tour-fly-summary-brief", popover: { title: "Daily Brief", description: "Get an AI-generated summary of today's execution across the entire organization.", side: "bottom", align: "start" } },
    ];
  } else if (tab === "leadership") {
    steps = [
      { element: "#tour-fly-leadership-content", popover: { title: "Leadership View", description: "Track zone-by-zone performance metrics, active blockers, and hot leads.", side: "top", align: "start" } },
    ];
  }

  usePageTour(`fly_board_tour_${tab}`, steps);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Hero */}
      <header className="mb-6">
        <div className="flex items-center gap-2 font-mono text-[10px] md:text-xs uppercase tracking-widest text-primary mb-2">
          <PlaneTakeoff className="h-3.5 w-3.5" />
          Fly Board
        </div>
        <h1 className="font-display text-3xl md:text-5xl font-semibold leading-tight tracking-tight">
          The daily execution board.
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-2xl">
          One screen, one rhythm. Updates, blockers, hot leads and the day's brief — without endless
          meetings or WhatsApp scroll.
        </p>
      </header>

      {/* Tabs */}
      <div
        id="tour-fly-tabs"
        className="flex gap-1 mb-6 border-b border-border overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              id={`tour-fly-tab-${id}`}
              onClick={() => setTab(id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          );
        })}
      </div>

      {tab === "daily" && <DailyTab actor={actor} />}
      {tab === "retro" && <RetroTab actor={actor} />}
      {tab === "feed" && <FeedTab actor={actor} />}
      {tab === "tasks" && <ActionItemsTab actor={actor} />}
      {tab === "summary" && <SummaryTab />}
      {tab === "leadership" && <LeadershipTab />}
    </div>
  );
}

// =================== DAILY UPDATE TAB ===================
function DailyTab({ actor }: { actor: Employee }) {
  const updates = useDailyUpdates();
  const existing = todayUpdateFor(actor.id);
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const { zones: storeZones } = useZoneStore();
  const zones = storeZones.map((z) => z.name).sort();
  const visibleUpdates = updates.filter((u) => zoneFilter === "all" || u.zone === zoneFilter);
  const [form, setForm] = useState(() => ({
    connectedCalls: existing?.connectedCalls ?? 0,
    visitsScheduled: existing?.visitsScheduled ?? 0,
    visitsCompleted: existing?.visitsCompleted ?? 0,
    hotLeads: existing?.hotLeads ?? 0,
    bookings: existing?.bookings ?? 0,
    blocker: existing?.blocker ?? "",
    propertyIssue: existing?.propertyIssue ?? "",
    tomorrowPriority: existing?.tomorrowPriority ?? "",
    zone: existing?.zone ?? actor.zone ?? "All",
  }));

  function num(field: keyof typeof form, delta: number) {
    setForm((f) => ({ ...f, [field]: Math.max(0, (f[field] as number) + delta) }));
  }

  function onSubmit() {
    submitDailyUpdate({ authorId: actor.id, ...form });
    toast.success("Daily update posted to the team feed.");
  }

  const numField = (label: string, key: keyof typeof form, icon: typeof Phone) => {
    const Icon = icon;
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="flex items-center gap-2 w-full min-w-0">
          <button
            onClick={() => num(key, -1)}
            className="h-10 w-10 flex-shrink-0 rounded-xl border border-border hover:bg-secondary text-lg leading-none"
            aria-label={`decrease ${label}`}
          >
            −
          </button>
          <input
            type="number"
            value={form[key] as number}
            onChange={(e) =>
              setForm((f) => ({ ...f, [key]: Math.max(0, parseInt(e.target.value || "0", 10)) }))
            }
            className="h-10 flex-1 min-w-0 text-center text-lg font-semibold bg-background border border-border rounded-xl px-2"
          />
          <button
            onClick={() => num(key, 1)}
            className="h-10 w-10 flex-shrink-0 rounded-xl border border-border hover:bg-secondary text-lg leading-none"
            aria-label={`increase ${label}`}
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid md:grid-cols-[1.2fr_1fr] gap-6">
      <section id="tour-fly-daily-form">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-semibold">Your update for today</h2>
          {existing && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-success">
              ✓ Posted · editing
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 mb-3">
          {numField("Connected calls", "connectedCalls", Phone)}
          {numField("Tours scheduled", "visitsScheduled", CalIcon)}
          {numField("Tours completed", "visitsCompleted", MapPin)}
          {numField("Hot leads", "hotLeads", Flame)}
          {numField("Bookings done", "bookings", IndianRupee)}
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
              <Building2 className="h-3.5 w-3.5" /> Zone
            </div>
            <input
              value={form.zone}
              onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
              className="h-9 w-full px-2 bg-background border border-border rounded-md text-sm"
              placeholder="Whitefield"
            />
          </div>
        </div>

        <Textarea
          label="Main blocker"
          icon={AlertTriangle}
          value={form.blocker}
          onChange={(v) => setForm((f) => ({ ...f, blocker: v }))}
          placeholder="What's stopping you today?"
        />
        <Textarea
          label="Property issue"
          icon={Building2}
          value={form.propertyIssue}
          onChange={(v) => setForm((f) => ({ ...f, propertyIssue: v }))}
          placeholder="WiFi, plumbing, owner issues, room status…"
        />
        <Textarea
          label="Priority for tomorrow"
          icon={Target}
          value={form.tomorrowPriority}
          onChange={(v) => setForm((f) => ({ ...f, tomorrowPriority: v }))}
          placeholder="The one thing that has to move."
        />

        <button
          onClick={onSubmit}
          className="mt-4 w-full md:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-medium text-sm hover:opacity-90"
        >
          <Send className="h-4 w-4" /> Post update
        </button>
      </section>

      <aside>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-semibold">Team updates today</h2>
          <div className="w-[130px]">
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="h-8 text-xs bg-card">
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-3">
          {visibleUpdates.length === 0 && (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
              No updates match.
            </div>
          )}
          {visibleUpdates.map((u) => {
            const author = empOf(u.authorId);
            return (
              <article key={u.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar id={u.authorId} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {author?.name ?? "Unknown"}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {u.zone} · {ago(u.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-mono uppercase tracking-widest mb-2">
                  <Stat n={u.connectedCalls} l="Calls" />
                  <Stat n={u.visitsCompleted} l="Tours" />
                  <Stat n={u.hotLeads} l="Hot" />
                  <Stat n={u.bookings} l="Book" />
                  <Stat n={u.visitsScheduled} l="Sched" />
                </div>
                {u.blocker && (
                  <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-md px-2 py-1.5 mb-1.5">
                    <AlertTriangle className="inline h-3 w-3 mr-1" /> {u.blocker}
                  </p>
                )}
                {u.tomorrowPriority && (
                  <p className="text-xs text-muted-foreground">
                    <Target className="inline h-3 w-3 mr-1" /> {u.tomorrowPriority}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="border border-border rounded px-1 py-1">
      <div className="text-sm font-semibold normal-case tracking-normal">{n}</div>
      <div className="text-muted-foreground">{l}</div>
    </div>
  );
}

function Textarea({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  icon: typeof Phone;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mb-3">
      <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm resize-none focus:outline-none focus:border-primary"
      />
    </div>
  );
}

// =================== RETRO TAB ===================
function RetroTab({ actor }: { actor: Employee }) {
  const items = useRetroItems();
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const authors = Array.from(new Set(items.map((i) => i.authorId)));
  const visibleItems = items.filter((i) => authorFilter === "all" || i.authorId === authorFilter);
  const cols: { kind: RetroKind; title: string; color: string; placeholder: string }[] = [
    {
      kind: "start",
      title: "START",
      color: "border-success/40 bg-success/5",
      placeholder: "What should we start doing?",
    },
    {
      kind: "stop",
      title: "STOP",
      color: "border-destructive/40 bg-destructive/5",
      placeholder: "What's hurting conversion?",
    },
    {
      kind: "continue",
      title: "CONTINUE",
      color: "border-info/40 bg-info/5",
      placeholder: "What's working — keep doing it.",
    },
  ];
  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="w-[150px]">
          <Select value={authorFilter} onValueChange={setAuthorFilter}>
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="All People" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All People</SelectItem>
              {authors.map((a) => (
                <SelectItem key={a} value={a}>
                  {empName(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div id="tour-fly-retro-columns" className="grid md:grid-cols-3 gap-4">
        {cols.map((col) => (
          <RetroColumn
            key={col.kind}
            col={col}
            items={visibleItems.filter((i) => i.kind === col.kind)}
            actorId={actor.id}
          />
        ))}
      </div>
    </div>
  );
}

function RetroColumn({
  col,
  items,
  actorId,
}: {
  col: { kind: RetroKind; title: string; color: string; placeholder: string };
  items: RetroItem[];
  actorId: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <section className={`rounded-lg border-2 ${col.color} p-3`}>
      <h3 className="font-mono text-xs uppercase tracking-widest font-bold mb-3">{col.title}</h3>
      <div className="space-y-2 mb-3">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No items yet.</p>
        )}
        {items.map((it) => (
          <RetroCard key={it.id} item={it} actorId={actorId} />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              addRetro(col.kind, actorId, draft);
              setDraft("");
            }
          }}
          placeholder={col.placeholder}
          className="flex-1 h-9 px-3 bg-background border border-border rounded-md text-sm"
        />
        <button
          onClick={() => {
            if (draft.trim()) {
              addRetro(col.kind, actorId, draft);
              setDraft("");
            }
          }}
          className="h-9 px-3 bg-primary text-primary-foreground rounded-md text-sm font-medium"
        >
          Add
        </button>
      </div>
    </section>
  );
}

function RetroCard({ item, actorId }: { item: RetroItem; actorId: string }) {
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const voted = item.upvotes.includes(actorId);
  return (
    <article className="rounded-md border border-border bg-card p-2.5">
      <div className="flex gap-2">
        <button
          onClick={() => toggleRetroUpvote(item.id, actorId)}
          className={`shrink-0 flex flex-col items-center justify-center w-10 h-12 rounded border transition-colors ${
            voted
              ? "bg-primary/15 border-primary/40 text-primary"
              : "border-border hover:border-primary/40"
          }`}
        >
          <ArrowUp className="h-3.5 w-3.5" />
          <span className="text-xs font-mono font-bold">{item.upvotes.length}</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug">{item.body}</p>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <Avatar id={item.authorId} size={14} />
            <span>{empName(item.authorId).split(" ")[0]}</span>
            <span>· {ago(item.createdAt)}</span>
            <button
              onClick={() => setShowComments((v) => !v)}
              className="ml-auto inline-flex items-center gap-0.5 hover:text-foreground"
            >
              <MessageCircle className="h-3 w-3" /> {item.comments.length}
            </button>
          </div>
        </div>
      </div>
      {showComments && (
        <div className="mt-2 pt-2 border-t border-border space-y-1.5">
          {item.comments.map((c) => (
            <div key={c.id} className="text-xs">
              <span className="font-semibold">{empName(c.authorId).split(" ")[0]}: </span>
              <span className="text-muted-foreground">{c.body}</span>
            </div>
          ))}
          <div className="flex gap-1">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && comment.trim()) {
                  addRetroComment(item.id, actorId, comment);
                  setComment("");
                }
              }}
              placeholder="Reply…"
              className="flex-1 h-7 px-2 bg-background border border-border rounded text-xs"
            />
          </div>
        </div>
      )}
    </article>
  );
}

// =================== FEED TAB ===================
const FEED_KIND_META: Record<FeedKind, { color: string; icon: typeof Flame }> = {
  visit: { color: "text-info border-info/30 bg-info/10", icon: MapPin },
  lead: { color: "text-warning border-warning/30 bg-warning/10", icon: Flame },
  blocker: {
    color: "text-destructive border-destructive/30 bg-destructive/10",
    icon: AlertTriangle,
  },
  callback: { color: "text-primary border-primary/30 bg-primary/10", icon: Phone },
  booking: { color: "text-success border-success/30 bg-success/10", icon: IndianRupee },
  issue: { color: "text-destructive border-destructive/30 bg-destructive/10", icon: AlertTriangle },
  win: { color: "text-success border-success/30 bg-success/10", icon: Trophy },
  system: { color: "text-muted-foreground border-border bg-secondary", icon: Sparkles },
  tour: { color: "text-info border-info/30 bg-info/10", icon: CalIcon },
};

function FeedTab({ actor }: { actor: Employee }) {
  const feed = useFeed();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<FeedKind>("win");
  const [kindFilter, setKindFilter] = useState<FeedKind | "all">("all");
  const visibleFeed = feed.filter((f) => kindFilter === "all" || f.kind === kindFilter);

  function onPost() {
    if (!body.trim()) return;
    postFeed({ kind, authorId: actor.id, zone: actor.zone, body });
    setBody("");
    toast.success("Posted to the feed.");
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div id="tour-fly-feed-form" className="rounded-lg border border-border bg-card p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Avatar id={actor.id} size={28} />
          <div className="w-[120px]">
            <Select value={kind} onValueChange={(val) => setKind(val as FeedKind)}>
              <SelectTrigger className="h-8 text-xs font-mono uppercase tracking-widest bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FEED_KIND_META) as FeedKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share an update with the team…"
          rows={2}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm resize-none focus:outline-none focus:border-primary"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={onPost}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium"
          >
            <Send className="h-3.5 w-3.5" /> Post
          </button>
        </div>
      </div>

      <div className="flex justify-end mb-3">
        <div className="w-[140px]">
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as FeedKind | "all")}>
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {(Object.keys(FEED_KIND_META) as FeedKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {visibleFeed.map((f) => (
          <FeedCard key={f.id} ev={f} actorId={actor.id} />
        ))}
      </div>
    </div>
  );
}

function FeedCard({ ev, actorId }: { ev: FeedEvent; actorId: string }) {
  const meta = FEED_KIND_META[ev.kind];
  const Icon = meta.icon;
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const voted = ev.upvotes.includes(actorId);
  return (
    <article className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <Avatar id={ev.authorId} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{empName(ev.authorId)}</span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase tracking-widest ${meta.color}`}
            >
              <Icon className="h-2.5 w-2.5" /> {ev.kind}
            </span>
            {ev.zone && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                · {ev.zone}
              </span>
            )}
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground ml-auto">
              {ago(ev.ts)}
            </span>
          </div>
          <p className="text-sm mt-1.5">{ev.body}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <button
              onClick={() => toggleFeedUpvote(ev.id, actorId)}
              className={`inline-flex items-center gap-1 ${voted ? "text-primary" : "hover:text-foreground"}`}
            >
              <ArrowUp className="h-3.5 w-3.5" /> {ev.upvotes.length}
            </button>
            <button
              onClick={() => setShowComments((v) => !v)}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" /> {ev.comments.length}
            </button>
          </div>
          {showComments && (
            <div className="mt-2 pt-2 border-t border-border space-y-1.5">
              {ev.comments.map((c) => (
                <div key={c.id} className="text-xs">
                  <span className="font-semibold">{empName(c.authorId).split(" ")[0]}: </span>
                  <span className="text-muted-foreground">{c.body}</span>
                </div>
              ))}
              <div className="flex gap-1">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && comment.trim()) {
                      addFeedComment(ev.id, actorId, comment);
                      setComment("");
                    }
                  }}
                  placeholder="Reply…"
                  className="flex-1 h-7 px-2 bg-background border border-border rounded text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// =================== ACTION ITEMS TAB ===================
function ActionItemsTab({ actor }: { actor: Employee }) {
  const all = useTasks();
  // Show recent action items; treat "Fly" tasks as those whose title starts with [Fly] or just show all assigned
  const items = useMemo(() => [...all].sort((a, b) => a.dueAt - b.dueAt).slice(0, 30), [all]);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(actor.id);
  const [dueDays, setDueDays] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const visibleItems = items.filter((t) => statusFilter === "all" || t.status === statusFilter);

  function create() {
    if (!title.trim()) return;
    createTask({
      title: `[Fly] ${title.trim()}`,
      description: "",
      assigneeId: assignee,
      assignedById: actor.id,
      priority: "high",
      dueAt: Date.now() + dueDays * 86400000,
    });
    setTitle("");
    toast.success("Action item created.");
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div id="tour-fly-tasks-form" className="rounded-lg border border-border bg-card p-4 mb-5">
        <h3 className="font-display text-lg font-semibold mb-3">Create action item</h3>
        <div className="grid md:grid-cols-[1fr_180px_120px_auto] gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fix WiFi at Oryn Girls"
            className="h-10 px-3 bg-background border border-border rounded-md text-sm"
          />
          <div className="w-full">
            <Select value={assignee} onValueChange={(val) => setAssignee(val)}>
              <SelectTrigger className="h-10 bg-background border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getRoster().map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full">
            <Select value={dueDays.toString()} onValueChange={(val) => setDueDays(parseInt(val))}>
              <SelectTrigger className="h-10 bg-background border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Tomorrow</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">1 week</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={create}
            className="h-10 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium"
          >
            Assign
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display text-lg font-semibold">Action Items List</h3>
        <div className="w-[120px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs bg-card">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="doing">Doing</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {visibleItems.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
          >
            <button
              onClick={() => setTaskStatus(t.id, t.status === "done" ? "todo" : "done", actor.id)}
              className={`shrink-0 h-5 w-5 rounded border flex items-center justify-center ${
                t.status === "done" ? "bg-success border-success text-white" : "border-border"
              }`}
            >
              {t.status === "done" && <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}
              >
                {t.title}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {empName(t.assigneeId)} · due {new Date(t.dueAt).toLocaleDateString()}
              </div>
            </div>
            <span
              className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${
                t.status === "done"
                  ? "border-success/40 text-success"
                  : t.status === "doing"
                    ? "border-info/40 text-info"
                    : "border-border text-muted-foreground"
              }`}
            >
              {t.status}
            </span>
          </div>
        ))}
        {visibleItems.length === 0 && (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
            No action items match.
          </div>
        )}
      </div>
    </div>
  );
}

// =================== AI SUMMARY TAB ===================
function SummaryTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SummaryOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    setIsFallback(false);
    try {
      const res = await fetchDailyBrief();
      setResult(res.summary);
      if (res.fallback) {
        setIsFallback(true);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      if (msg.includes("429")) setError("Rate limited — try again in a minute.");
      else if (msg.includes("402")) setError("AI credits exhausted. Add credits in Lovable Cloud.");
      else setError("Summary temporarily unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="tour-fly-summary-brief" className="max-w-3xl mx-auto">
      <div className="rounded-lg border border-border bg-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">AI Daily Summary</h2>
            <p className="text-xs text-muted-foreground">
              One-page summary for leadership — best zone, weak zone, top blocker, hot-lead risk,
              priorities.
            </p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? "Reading today's board…" : "Generate today's summary"}
        </button>
        {error && <p className="text-xs text-destructive mt-3">{error}</p>}
      </div>

      {result && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-4">
          {isFallback && (
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-warning bg-warning/10 border border-warning/20 rounded-md p-2.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Note: Displaying active operational rollup
              (AI fallback mode).
            </div>
          )}
          <p className="font-display text-lg leading-snug">{result.oneLineForLeadership}</p>
          <div className="grid md:grid-cols-2 gap-3">
            <SummaryCell label="Best zone" value={result.bestZone} tone="success" />
            <SummaryCell label="Weak zone" value={result.weakZone} tone="warning" />
            <SummaryCell label="Top performer" value={result.topPerformer} tone="info" />
            <SummaryCell label="Top blocker" value={result.topBlocker} tone="destructive" />
            <SummaryCell label="Hot-lead risk" value={result.hotLeadRisk} tone="warning" />
          </div>
          {result.priorities.length > 0 && (
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Tomorrow's priorities
              </div>
              <ol className="space-y-1.5">
                {result.priorities.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "info" | "destructive";
}) {
  const toneCls = {
    success: "border-success/30 bg-success/5 text-success",
    warning: "border-warning/30 bg-warning/5 text-warning",
    info: "border-info/30 bg-info/5 text-info",
    destructive: "border-destructive/30 bg-destructive/5 text-destructive",
  }[tone];
  return (
    <div className={`rounded-md border p-3 ${toneCls}`}>
      <div className="text-[10px] font-mono uppercase tracking-widest opacity-80 mb-1">{label}</div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

// =================== LEADERSHIP TAB ===================
function LeadershipTab() {
  const roll = todayRollup();
  const feed = useFeed();
  const hot = feed.filter((f) => f.kind === "lead" || f.kind === "callback").slice(0, 5);
  const blockers = feed.filter((f) => f.kind === "blocker" || f.kind === "issue").slice(0, 5);

  return (
    <div id="tour-fly-leadership-content" className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Calls today" value={roll.totals.calls} icon={Phone} tone="info" />
        <KPI label="Tours done" value={roll.totals.visitsCompleted} icon={MapPin} tone="primary" />
        <KPI label="Bookings" value={roll.totals.bookings} icon={IndianRupee} tone="success" />
        <KPI label="Hot leads" value={roll.totals.hotLeads} icon={Flame} tone="warning" />
        <KPI
          label="Blockers"
          value={roll.totals.blockers}
          icon={AlertTriangle}
          tone="destructive"
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-semibold">Zones</h3>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {roll.submissions} of {roll.teamSize} reported
          </span>
        </div>
        <Progress
          value={(roll.submissions / Math.max(1, roll.teamSize)) * 100}
          className="h-1.5 mb-4"
        />
        <div className="space-y-2">
          {roll.zones.length === 0 && (
            <p className="text-sm text-muted-foreground">No zone data yet today.</p>
          )}
          {roll.zones.map((z, i) => (
            <div
              key={z.zone}
              className="grid grid-cols-[1fr_repeat(5,_minmax(0,40px))] gap-2 items-center py-1.5 border-b border-border last:border-0 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${
                    i === 0
                      ? "bg-success text-white"
                      : i === roll.zones.length - 1
                        ? "bg-warning text-white"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="font-medium truncate">{z.zone}</span>
              </div>
              <ZNum n={z.calls} />
              <ZNum n={z.visitsCompleted} />
              <ZNum n={z.hotLeads} />
              <ZNum n={z.bookings} />
              <ZNum n={z.blockers} bad={z.blockers > 0} />
            </div>
          ))}
          <div className="grid grid-cols-[1fr_repeat(5,_minmax(0,40px))] gap-2 items-center pt-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            <span></span>
            <span className="text-center">Calls</span>
            <span className="text-center">Tours</span>
            <span className="text-center">Hot</span>
            <span className="text-center">Book</span>
            <span className="text-center">Block</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <FeedCol
          title="Hot leads pending"
          items={hot}
          empty="No hot leads pending — well done."
          tone="warning"
        />
        <FeedCol
          title="Major blockers"
          items={blockers}
          empty="No blockers flagged today."
          tone="destructive"
        />
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Phone;
  tone: "info" | "primary" | "success" | "warning" | "destructive";
}) {
  const toneCls = {
    info: "text-info bg-info/10 border-info/30",
    primary: "text-primary bg-primary/10 border-primary/30",
    success: "text-success bg-success/10 border-success/30",
    warning: "text-warning bg-warning/10 border-warning/30",
    destructive: "text-destructive bg-destructive/10 border-destructive/30",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div
        className={`inline-flex items-center justify-center h-7 w-7 rounded-md border mb-2 ${toneCls}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="text-2xl font-display font-bold leading-none">{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
        {label}
      </div>
    </div>
  );
}

function ZNum({ n, bad }: { n: number; bad?: boolean }) {
  return (
    <div className={`text-center font-mono text-sm ${bad ? "text-destructive font-semibold" : ""}`}>
      {n}
    </div>
  );
}

function FeedCol({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: FeedEvent[];
  empty: string;
  tone: "warning" | "destructive";
}) {
  const toneCls =
    tone === "warning"
      ? "border-warning/30 text-warning"
      : "border-destructive/30 text-destructive";
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3
        className={`font-display text-base font-semibold mb-3 inline-flex items-center gap-1.5 ${toneCls.split(" ")[1]}`}
      >
        <TrendingUp className="h-4 w-4" /> {title}
      </h3>
      {items.length === 0 && <p className="text-xs text-muted-foreground">{empty}</p>}
      <div className="space-y-2">
        {items.map((f) => (
          <div key={f.id} className={`rounded-md border ${toneCls} bg-background p-2`}>
            <p className="text-sm">{f.body}</p>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
              {empName(f.authorId)} · {f.zone ?? "—"} · {ago(f.ts)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
