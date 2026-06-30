import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useKudos, tagColor } from "@/lib/kudos-store";
import { Avatar } from "@/components/Avatar";
import { useRoster } from "@/hooks/useRoster";
import { GiveKudoModal } from "@/components/GiveKudoModal";
import { Heart, Plus } from "lucide-react";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/kudos")({
  component: KudosPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

function timeAgo(ts: number) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function KudosPage() {
  usePageTour("kudos_tour", [
    {
      popover: {
        title: "Kudos Wall",
        description: "Welcome to the Recognition Wall. This is where we celebrate our team's wins and core values.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-kudos-new",
      popover: { title: "Give a Kudo", description: "Catch someone doing something right! Click here to give a teammate public recognition.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-kudos-feed",
      popover: { title: "The Feed", description: "All recent kudos from across the organization appear here.", side: "top", align: "start" }
    }
  ]);

  const kudos = useKudos();
  const roster = useRoster();
  const [open, setOpen] = useState(false);

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[900px] mx-auto">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
            Recognition Wall
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">Kudos</h1>
          <p className="text-muted-foreground text-sm mt-1">Public, specific, generous.</p>
        </div>
        <button
          id="tour-kudos-new"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Give kudo
        </button>
      </header>
      <div id="tour-kudos-feed" className="space-y-3">
        {kudos.map((k) => {
          const from = roster.find((e) => e.id === k.fromId);
          const to = roster.find((e) => e.id === k.toId);
          return (
            <div key={k.id} className="rounded-2xl bg-card border border-border p-4 flex gap-3">
              <Avatar id={k.fromId} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-medium">{from?.name.split(" ")[0]}</span>
                  <Heart className="h-3 w-3 text-primary" />
                  <span className="font-medium">{to?.name.split(" ")[0]}</span>
                  <span
                    className={`text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border ${tagColor(k.tag)}`}
                  >
                    {k.tag}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                    {timeAgo(k.ts)}
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed">"{k.message}"</div>
              </div>
            </div>
          );
        })}
      </div>
      <GiveKudoModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
