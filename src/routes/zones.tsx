import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Map as MapIcon,
  Building2,
  Users,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Phone,
  Target,
  Flame,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { getRoster } from "@/lib/roster";
import {
  useZoneStore,
  propertiesOfZone,
  ticketsOfZone,
  inr,
  occPct,
  store,
} from "@/lib/zones-store";
import type { Zone, Property } from "@/data/zones";
import { useAttendanceState } from "@/hooks/useAttendance";
import { tierOf } from "@/lib/permissions";
import { Avatar } from "@/components/Avatar";
import { todayRollup } from "@/lib/fly-store";

export const Route = createFileRoute("/zones")({
  component: ZonesPage,
  head: () => ({
    meta: [
      { title: "Zones — Core Arena" },
      { name: "description", content: "Every zone, every property, every number — at a glance." },
    ],
  }),
});

function ZonesPage() {
  const { actor } = useAttendanceState();
  const tier = tierOf(actor);
  const { zones } = useZoneStore();
  const myZone = useMemo(() => zones.find((z) => z.leaderId === actor.id) ?? zones[0], [actor.id, zones]);
  const [selected, setSelected] = useState<Zone | undefined>(tier === "zone_leader" ? myZone : zones[0]);
  const rollup = todayRollup();

  // If no zones loaded yet or hydrated empty
  if (!selected) return <div className="p-8">Loading zones...</div>;

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
      <header className="mb-6">
        <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-primary mb-2">
          {tier === "zone_leader" ? `Zone Leader · ${selected.name}` : "Leadership · All Zones"}
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight">
          {tier === "zone_leader" ? selected.name : "Network at a glance."}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {tier === "zone_leader"
            ? "Every pod, every property, every number — under your name."
            : "Compare zones side by side. Drill into any city, any property."}
        </p>
      </header>

      {/* Zone tabs */}
      <div className="flex gap-2 overflow-x-auto mb-6 -mx-4 px-4 md:mx-0 md:px-0">
        {zones.map((z) => {
          const isMine = z.id === selected.id;
          const props = propertiesOfZone(z.id);
          const beds = props.reduce((s, p) => s + p.beds, 0);
          const occ = props.reduce((s, p) => s + p.occupied, 0);
          const pct = Math.round((occ / beds) * 100);
          return (
            <button
              key={z.id}
              onClick={() => setSelected(z)}
              className={`shrink-0 text-left p-3 rounded-xl border min-w-[200px] transition-colors ${
                isMine
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {z.city}
              </div>
              <div className="font-display text-lg font-semibold mt-0.5">{z.name}</div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="tabular-nums">{pct}% occ</span>
                <span>·</span>
                <span>{props.length} props</span>
                <span>·</span>
                <span>{z.pods} pods</span>
              </div>
            </button>
          );
        })}
      </div>

      <ZoneDashboard zone={selected} todayCalls={rollup.totals.calls} />
    </div>
  );
}

function ZoneDashboard({ zone, todayCalls }: { zone: Zone; todayCalls: number }) {
  const props = propertiesOfZone(zone.id);
  const tickets = ticketsOfZone(zone.id);
  const leader = getRoster().find((e) => e.id === zone.leaderId);
  const teamInZone = getRoster().filter((e) => e.zone === zone.name);

  const beds = props.reduce((s, p) => s + p.beds, 0);
  const occupied = props.reduce((s, p) => s + p.occupied, 0);
  const revenue = props.reduce((s, p) => s + p.monthlyRevenue, 0);
  const vacancy = beds - occupied;
  const openTickets = tickets.filter((t) => t.status !== "Resolved").length;
  const avgRating = (props.reduce((s, p) => s + p.rating, 0) / Math.max(1, props.length)).toFixed(
    1,
  );

  const KPIs: {
    label: string;
    value: string;
    sub: string;
    icon: React.ElementType;
    tone: string;
  }[] = [
    {
      label: "Occupancy",
      value: `${Math.round((occupied / beds) * 100)}%`,
      sub: `${occupied}/${beds} beds`,
      icon: Building2,
      tone: "text-success",
    },
    {
      label: "Monthly revenue",
      value: inr(revenue),
      sub: `${props.length} properties`,
      icon: IndianRupee,
      tone: "text-primary",
    },
    {
      label: "Vacancies",
      value: String(vacancy),
      sub: `${Math.round((vacancy / beds) * 100)}% of inventory`,
      icon: TrendingDown,
      tone: "text-warning",
    },
    {
      label: "Open tickets",
      value: String(openTickets),
      sub: `${tickets.length} total`,
      icon: AlertTriangle,
      tone: openTickets > 2 ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "Avg property rating",
      value: `${avgRating} ★`,
      sub: "tenant reviews",
      icon: TrendingUp,
      tone: "text-info",
    },
    {
      label: "Team in zone",
      value: String(teamInZone.length),
      sub: `${zone.pods} pods`,
      icon: Users,
      tone: "text-foreground",
    },
    {
      label: "Calls today",
      value: String(todayCalls),
      sub: "all pods combined",
      icon: Phone,
      tone: "text-primary",
    },
    {
      label: "Hot leads today",
      value: String(Math.max(3, Math.round(todayCalls / 12))),
      sub: "from Fly board",
      icon: Flame,
      tone: "text-warning",
    },
  ];

  return (
    <>
      {/* Leader card */}
      {leader && (
        <section className="rounded-xl bg-card border border-border p-5 mb-6 flex items-center gap-4">
          <Avatar id={leader.id} size={48} />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Zone Leader
            </div>
            <div className="font-display text-lg font-semibold truncate">{leader.name}</div>
            <div className="text-xs text-muted-foreground truncate">{leader.bio}</div>
          </div>
          <Link
            to="/one-on-ones"
            className="hidden md:inline-flex h-9 px-4 items-center rounded-md border border-border text-xs font-mono uppercase tracking-widest hover:bg-secondary"
          >
            Open 1:1
          </Link>
        </section>
      )}

      {/* KPI grid — 10x */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {KPIs.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl bg-card border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {k.label}
                </span>
                <Icon className={`h-4 w-4 ${k.tone}`} />
              </div>
              <div className={`font-display text-2xl font-semibold tabular-nums ${k.tone}`}>
                {k.value}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</div>
            </div>
          );
        })}
      </section>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* Properties table */}
        <section className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Properties</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {props.length} active
            </span>
          </div>
          <div className="divide-y divide-border">
            {props.map((p) => (
              <PropertyRow key={p.id} p={p} />
            ))}
          </div>
        </section>

        {/* Tickets + team */}
        <div className="space-y-6">
          <section className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Open tickets</h2>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {openTickets} open
              </span>
            </div>
            {tickets.length === 0 && (
              <div className="px-5 py-8 text-sm text-muted-foreground text-center">
                No tickets in this zone.
              </div>
            )}
            <div className="divide-y divide-border">
              {tickets.slice(0, 6).map((t) => {
                const { properties } = store.read();
                const prop = properties.find((p) => p.id === t.propertyId);
                const tone =
                  t.priority === "High"
                    ? "text-destructive border-destructive/30 bg-destructive/10"
                    : t.priority === "Med"
                      ? "text-warning border-warning/30 bg-warning/10"
                      : "text-muted-foreground border-border bg-secondary";
                return (
                  <div key={t.id} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span
                        className={`shrink-0 mt-0.5 text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${tone}`}
                      >
                        {t.priority}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-snug">{t.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {prop?.name} · {t.category} · {t.status}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">Team in zone</h2>
            </div>
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
              {teamInZone.map((e) => (
                <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                  <Avatar id={e.id} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.name}</div>
                    <div className="text-[11px] text-muted-foreground">{e.role}</div>
                  </div>
                  <span className="text-xs font-mono tabular-nums">{e.performance}</span>
                </div>
              ))}
              {teamInZone.length === 0 && (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No teammates mapped to this zone yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Daily call for zone */}
      <section className="mt-6 rounded-xl bg-sidebar text-sidebar-foreground border border-sidebar-border p-5">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Target className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-widest">
            Today's call · {zone.name}
          </span>
        </div>
        <p className="text-sm text-white leading-relaxed">
          Close the {vacancy} vacant beds before month end.{" "}
          {openTickets > 0 &&
            `${openTickets} open ticket${openTickets > 1 ? "s" : ""} blocking trust — resolve high-priority first.`}{" "}
          Revenue at <span className="text-primary font-semibold">{inr(revenue)}</span>/mo; ceiling
          is{" "}
          <span className="text-primary font-semibold">
            {inr(Math.round(revenue * (beds / occupied)))}
          </span>{" "}
          at full occupancy.
        </p>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link
            to="/fly"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest"
          >
            Open Fly Board <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            to="/war-room"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-sidebar-border text-xs font-mono uppercase tracking-widest hover:bg-sidebar-hover/40"
          >
            War Room
          </Link>
        </div>
      </section>
    </>
  );
}

function PropertyRow({ p }: { p: Property }) {
  const pct = occPct(p);
  const tone =
    pct >= 90 ? "bg-success" : pct >= 70 ? "bg-info" : pct >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="px-4 md:px-5 py-3 flex items-center gap-3">
      <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Building2 className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{p.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {p.type} · {p.address} · ★ {p.rating}
        </div>
      </div>
      <div className="hidden md:block w-32">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Occupancy
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="text-right hidden sm:block">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Revenue
        </div>
        <div className="text-sm font-semibold tabular-nums">{inr(p.monthlyRevenue)}</div>
      </div>
    </div>
  );
}
