import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Wallet,
  MessageSquareWarning,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Star,
  Phone,
  MapPin,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import {
  PARTNER_TICKETS,
  PARTNER_PAYOUTS,
  propertiesOfPartner,
  payoutsOfPartner,
  ticketsOfPartner,
  useZoneStore,
  store as zoneStore,
  type PartnerPayout,
  type PartnerTicket,
} from "@/lib/zones-store";
import { inr, occPct } from "@/data/zones";
import type { Property, Zone } from "@/data/zones";
import { getRoster } from "@/lib/roster";
import { useAttendanceState } from "@/hooks/useAttendance";
import { tierOf } from "@/lib/permissions";
import { Avatar } from "@/components/Avatar";
import { emit, zoneLeaderFor } from "@/lib/event-bus";
import { createTask } from "@/lib/task-store";
import { pushNotification } from "@/lib/notification-store";
import { MissionBrief } from "@/components/MissionBrief";

export const Route = createFileRoute("/partner")({
  component: PartnerPage,
  head: () => ({
    meta: [
      { title: "My Properties — Core Arena" },
      {
        name: "description",
        content: "Your properties, occupancy, payouts, and tickets — one workspace.",
      },
    ],
  }),
});

type Tab = "properties" | "payouts" | "tickets" | "visits" | "docs";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "properties", label: "Properties", icon: Building2 },
  { id: "payouts", label: "Payouts", icon: Wallet },
  { id: "tickets", label: "Requests", icon: MessageSquareWarning },
  { id: "visits", label: "Visits & Leads", icon: CalendarDays },
  { id: "docs", label: "Documents", icon: FileText },
];

function PartnerPage() {
  const { actor } = useAttendanceState();
  const tier = tierOf(actor);
  const partnerId = tier === "partner" ? actor.id : "e10"; // preview fallback
  const [tab, setTab] = useState<Tab>("properties");

  const props = useMemo(() => propertiesOfPartner(partnerId), [partnerId]);
  const payouts = useMemo(() => payoutsOfPartner(partnerId), [partnerId]);
  const tickets = useMemo(() => ticketsOfPartner(partnerId), [partnerId]);

  const totalBeds = props.reduce((s, p) => s + p.beds, 0);
  const totalOcc = props.reduce((s, p) => s + p.occupied, 0);
  const totalRev = props.reduce((s, p) => s + p.monthlyRevenue, 0);
  const nextPayout = payouts.filter((p) => p.status === "Scheduled").reduce((s, p) => s + p.net, 0);
  const openTickets = tickets.filter((t) => t.status !== "Resolved").length;

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1300px] mx-auto">
      <header className="mb-6">
        <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-primary mb-2">
          Property Partner · {actor.name.split(" ")[0]}
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight">
          Your portfolio, in one workspace.
        </h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
          Occupancy, monthly payouts, maintenance requests and the visit pipeline — all live, no
          follow-up calls needed.
        </p>
      </header>

      <MissionBrief actor={actor} />

      {/* Headline KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Kpi
          label="Properties"
          value={String(props.length)}
          sub={`${totalBeds} beds total`}
          icon={Building2}
          tone="text-primary"
        />
        <Kpi
          label="Occupancy"
          value={`${Math.round((totalOcc / Math.max(1, totalBeds)) * 100)}%`}
          sub={`${totalOcc}/${totalBeds} beds`}
          icon={TrendingUp}
          tone="text-success"
        />
        <Kpi
          label="Monthly revenue"
          value={inr(totalRev)}
          sub="gross, current month"
          icon={IndianRupee}
          tone="text-foreground"
        />
        <Kpi
          label="Next payout"
          value={inr(nextPayout)}
          sub={`${payouts.filter((p) => p.status === "Scheduled").length} invoices scheduled`}
          icon={Wallet}
          tone="text-info"
        />
      </section>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          const count =
            id === "tickets"
              ? openTickets
              : id === "payouts"
                ? payouts.filter((p) => p.status === "Scheduled").length
                : 0;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
              {count > 0 && (
                <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "properties" && <PropertiesTab props={props} />}
      {tab === "payouts" && <PayoutsTab payouts={payouts} />}
      {tab === "tickets" && <TicketsTab tickets={tickets} props={props} partnerId={partnerId} />}
      {tab === "visits" && <VisitsTab props={props} />}
      {tab === "docs" && <DocsTab props={props} />}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className={`font-display text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

// ============== Properties ==============
function PropertiesTab({ props }: { props: Property[] }) {
  if (props.length === 0) return <Empty label="No properties on the network yet." />;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {props.map((p) => {
        const pct = occPct(p);
        const tone =
          pct >= 90
            ? "bg-success"
            : pct >= 70
              ? "bg-info"
              : pct >= 50
                ? "bg-warning"
                : "bg-destructive";
        return (
          <article key={p.id} className="rounded-xl bg-card border border-border p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg font-semibold leading-tight">{p.name}</h3>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3" /> {p.address}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-secondary border border-border">
                    {p.type}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Star className="h-3 w-3 text-warning fill-warning" /> {p.rating}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="Beds" value={String(p.beds)} />
              <Stat label="Occupied" value={String(p.occupied)} />
              <Stat label="Vacant" value={String(p.beds - p.occupied)} />
            </div>
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                <span>Occupancy</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Monthly revenue
                </div>
                <div className="text-sm font-semibold tabular-nums">{inr(p.monthlyRevenue)}</div>
              </div>
              <Link
                to="/fly"
                className="text-[10px] font-mono uppercase tracking-widest text-primary"
              >
                View activity →
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 border border-border py-2 text-center">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// ============== Payouts ==============
function PayoutsTab({ payouts }: { payouts: PartnerPayout[] }) {
  if (payouts.length === 0) return <Empty label="No payouts yet." />;
  const grouped = payouts.reduce<Record<string, PartnerPayout[]>>((acc, p) => {
    (acc[p.month] ??= []).push(p);
    return acc;
  }, {});
  const months = Object.keys(grouped).reverse();

  return (
    <div className="space-y-6">
      {months.map((m) => {
        const rows = grouped[m];
        const total = rows.reduce((s, r) => s + r.net, 0);
        const status = rows.every((r) => r.status === "Paid")
          ? "Paid"
          : rows.some((r) => r.status === "On Hold")
            ? "On Hold"
            : "Scheduled";
        const statusTone =
          status === "Paid"
            ? "text-success"
            : status === "On Hold"
              ? "text-destructive"
              : "text-info";
        return (
          <section key={m} className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold">{m}</h3>
                <div
                  className={`text-[10px] font-mono uppercase tracking-widest mt-0.5 ${statusTone}`}
                >
                  {status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Net to you
                </div>
                <div className="font-display text-xl font-semibold tabular-nums">{inr(total)}</div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {rows.map((r) => {
                const prop = zoneStore.read().properties.find((p) => p.id === r.propertyId);
                return (
                  <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{prop?.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Gross {inr(r.gross)} − Fees {inr(r.deductions)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">{inr(r.net)}</div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        {r.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                All amounts in INR, post-GST.
              </span>
              <button className="text-[10px] font-mono uppercase tracking-widest text-primary inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> Download statement
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ============== Tickets ==============
function TicketsTab({
  tickets,
  props,
  partnerId,
}: {
  tickets: PartnerTicket[];
  props: Property[];
  partnerId: string;
}) {
  const [draft, setDraft] = useState({
    title: "",
    propertyId: props[0]?.id ?? "",
    category: "Maintenance" as PartnerTicket["category"],
    priority: "Med" as PartnerTicket["priority"],
  });
  const [composing, setComposing] = useState(false);
  const [localTickets, setLocalTickets] = useState<PartnerTicket[]>([]);

  function sendToOps() {
    if (!draft.title.trim()) return;
    const { properties, zones } = zoneStore.read();
    const prop = properties.find((p) => p.id === draft.propertyId);
    const zoneRow = prop ? zones.find((z) => z.id === prop.zoneId) : undefined;
    const zone = zoneRow?.name;
    const zl = zoneLeaderFor(zone);
    const opsOwner = zl ?? getRoster().find((e) => e.id === "e4") ?? getRoster()[0];
    const sevMap = { High: "urgent", Med: "med", Low: "low" } as const;

    const newTicket: PartnerTicket = {
      id: crypto.randomUUID(),
      propertyId: draft.propertyId,
      openedBy: partnerId,
      title: draft.title.trim(),
      category: draft.category,
      priority: draft.priority,
      status: "Open",
      assigneeId: opsOwner.id,
      ts: Date.now(),
      lastUpdate: `Routed to ${opsOwner.name.split(" ")[0]} · acknowledgement pending`,
    };
    setLocalTickets((cur) => [newTicket, ...cur]);

    emit({
      kind: "partner.ticket.opened",
      actorId: partnerId,
      targetId: opsOwner.id,
      zone,
      property: prop?.name,
      title: draft.title.trim(),
      body: `${prop?.name ?? "Property"} · ${draft.category} · ${draft.priority}`,
      severity: sevMap[draft.priority],
      deeplink: "/partner",
    });

    createTask({
      title: `Partner request: ${draft.title.trim().slice(0, 60)}`,
      description: `From property partner.\n\nProperty: ${prop?.name}\nCategory: ${draft.category}\nPriority: ${draft.priority}`,
      assigneeId: opsOwner.id,
      assignedById: partnerId,
      priority: draft.priority === "High" ? "urgent" : draft.priority === "Med" ? "high" : "med",
      dueAt:
        Date.now() +
        (draft.priority === "High" ? 4 : draft.priority === "Med" ? 24 : 72) * 3600_000,
      relatedTo: `Partner · ${prop?.name ?? ""}`,
      source: "auto",
    });

    pushNotification({
      kind: "system",
      toId: opsOwner.id,
      fromId: partnerId,
      title: `New partner ticket · ${draft.priority}`,
      body: draft.title.trim(),
      actionLabel: "Open",
      actionTo: "/tasks",
    });

    toast.success(`Sent to ${opsOwner.name.split(" ")[0]} — SLA started.`);
    setComposing(false);
    setDraft({ ...draft, title: "" });
  }

  const allTickets = [...localTickets, ...tickets];

  return (
    <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
      <section className="space-y-3">
        {allTickets.length === 0 && <Empty label="No tickets — quiet is the best status." />}
        {allTickets.map((t) => {
          const prop = zoneStore.read().properties.find((p) => p.id === t.propertyId);
          const assignee = t.assigneeId ? getRoster().find((e) => e.id === t.assigneeId) : null;
          const StatusIcon =
            t.status === "Resolved"
              ? CheckCircle2
              : t.status === "In Progress"
                ? Clock
                : AlertTriangle;
          const statusTone =
            t.status === "Resolved"
              ? "text-success"
              : t.status === "In Progress"
                ? "text-info"
                : "text-warning";
          const priorityTone =
            t.priority === "High"
              ? "text-destructive border-destructive/30 bg-destructive/10"
              : t.priority === "Med"
                ? "text-warning border-warning/30 bg-warning/10"
                : "text-muted-foreground border-border bg-secondary";
          return (
            <article key={t.id} className="rounded-xl bg-card border border-border p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`shrink-0 mt-0.5 text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${priorityTone}`}
                >
                  {t.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm leading-snug">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {prop?.name} · {t.category} · {new Date(t.ts).toLocaleDateString()}
                  </div>
                  {t.lastUpdate && (
                    <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-border pl-2">
                      "{t.lastUpdate}"
                    </p>
                  )}
                </div>
                <div className={`shrink-0 flex flex-col items-end ${statusTone}`}>
                  <StatusIcon className="h-4 w-4" />
                  <div className="text-[9px] font-mono uppercase tracking-widest mt-1">
                    {t.status}
                  </div>
                </div>
              </div>
              {assignee && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <Avatar id={assignee.id} size={20} />
                  <span className="text-[11px] text-muted-foreground">
                    Owned by {assignee.name.split(" ")[0]} · {assignee.role}
                  </span>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <aside>
        <div className="rounded-xl bg-card border border-border p-5 sticky top-20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">Raise a request</h3>
            {!composing && (
              <button
                onClick={() => setComposing(true)}
                className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-primary"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            )}
          </div>
          {!composing ? (
            <p className="text-xs text-muted-foreground">
              Maintenance, billing, tenant disputes, compliance — anything. Your zone leader gets
              paged in real time.
            </p>
          ) : (
            <div className="space-y-2.5">
              <Field label="Property">
                <select
                  value={draft.propertyId}
                  onChange={(e) => setDraft({ ...draft, propertyId: e.target.value })}
                  className="h-9 w-full px-2 bg-background border border-border rounded-md text-sm"
                >
                  {props.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="e.g. AC not cooling — Room 102"
                  className="h-9 w-full px-2 bg-background border border-border rounded-md text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Category">
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value as PartnerTicket["category"] })
                    }
                    className="h-9 w-full px-2 bg-background border border-border rounded-md text-sm"
                  >
                    <option>Maintenance</option>
                    <option>Billing</option>
                    <option>Tenant</option>
                    <option>Compliance</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    value={draft.priority}
                    onChange={(e) =>
                      setDraft({ ...draft, priority: e.target.value as PartnerTicket["priority"] })
                    }
                    className="h-9 w-full px-2 bg-background border border-border rounded-md text-sm"
                  >
                    <option>Low</option>
                    <option>Med</option>
                    <option>High</option>
                  </select>
                </Field>
              </div>
              <button
                onClick={sendToOps}
                disabled={!draft.title.trim()}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground h-10 rounded-md text-sm font-medium disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Send to ops
              </button>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
                {partnerId} · response within 4 working hours
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// ============== Visits & Leads ==============
function VisitsTab({ props }: { props: Property[] }) {
  const propIds = new Set(props.map((p) => p.id));
  // Fake demo visits derived from property roster
  const upcoming = props.slice(0, 4).map((p, i) => ({
    id: `v-${p.id}`,
    propertyId: p.id,
    at: Date.now() + (i + 1) * 2 * 60 * 60 * 1000,
    leadName: ["Anika G.", "Rohit M.", "Pooja S.", "Dev N."][i % 4],
    intent: ["Hot", "Warm", "Hot", "Cold"][i % 4] as "Hot" | "Warm" | "Cold",
  }));
  void propIds;

  const tone = (s: string) =>
    s === "Hot"
      ? "text-warning border-warning/30 bg-warning/10"
      : s === "Warm"
        ? "text-info border-info/30 bg-info/10"
        : "text-muted-foreground border-border bg-secondary";

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold">Upcoming visits</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Scheduled by your zone team in the next 48 hours.
          </p>
        </div>
        <div className="divide-y divide-border">
          {upcoming.map((v) => {
            const prop = zoneStore.read().properties.find((p) => p.id === v.propertyId);
            return (
              <div key={v.id} className="px-4 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {v.leadName} → {prop?.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(v.at).toLocaleString([], {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <span
                  className={`text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${tone(v.intent)}`}
                >
                  {v.intent}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">Live lead funnel</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              For all your properties combined.
            </p>
          </div>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <Stat label="Enquiries (7d)" value="48" />
          <Stat label="Visits booked" value="22" />
          <Stat label="Hot leads" value="9" />
          <Stat label="Closed" value="5" />
        </div>
        <div className="px-5 pb-5">
          <Link
            to="/fly"
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-primary"
          >
            <Phone className="h-3 w-3" /> Open call log
          </Link>
        </div>
      </section>
    </div>
  );
}

// ============== Documents ==============
function DocsTab({ props }: { props: Property[] }) {
  const docs = [
    { name: "Management Agreement v3.2", type: "Contract", status: "Signed", date: "12 Jan 2024" },
    { name: "KYC — Partner identity", type: "KYC", status: "Verified", date: "08 Jan 2024" },
    { name: "Bank account confirmation", type: "Finance", status: "Verified", date: "10 Jan 2024" },
    {
      name: "Fire NOC — Brook Luxe",
      type: "Compliance",
      status: "Renew by Jul",
      date: "Expires Jul 2026",
    },
    {
      name: "Property tax receipt — Aeris Boys",
      type: "Compliance",
      status: "Filed",
      date: "Mar 2026",
    },
  ];
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold">Agreements & records</h3>
        </div>
        <div className="divide-y divide-border">
          {docs.map((d, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {d.type} · {d.date}
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-success">
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl bg-card border border-border p-5">
        <h3 className="font-display text-lg font-semibold mb-2">Per-property files</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Each property has its own folder for inspection reports, photos, and tenant agreements.
        </p>
        <div className="space-y-2">
          {props.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-2.5 rounded-md border border-border"
            >
              <span className="text-sm font-medium truncate">{p.name}</span>
              <Link to="/" className="text-[10px] font-mono uppercase tracking-widest text-primary">
                Open folder →
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-12 text-center">
      {label}
    </div>
  );
}
