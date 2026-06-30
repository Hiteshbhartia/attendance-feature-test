import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Star,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  IndianRupee,
  Calendar,
  Sparkles,
} from "lucide-react";
import {
  useCandidates,
  moveCandidate,
  addCandidate,
  addCandidateNote,
  rejectCandidate,
  stageColor,
  pipelineStats,
} from "@/lib/recruiting-store";
import {
  CAND_STAGE_LABEL,
  CAND_STAGE_ORDER,
  type Candidate,
  type CandidateStage,
  type CandidateSource,
  type Role,
} from "@/types/hr";
import { useAttendanceState } from "@/hooks/useAttendance";
import { Avatar } from "@/components/Avatar";
import { RoleGate } from "@/components/RoleGate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/recruiting")({
  head: () => ({
    meta: [
      { title: "Recruiting Pipeline — Gharpayy Arena" },
      {
        name: "description",
        content: "Source, screen, interview, offer. The full hiring pipeline in one kanban view.",
      },
    ],
  }),
  component: RecruitingPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

const SOURCES: CandidateSource[] = [
  "Referral",
  "LinkedIn",
  "Naukri",
  "Walk-in",
  "Inbound",
  "Agency",
];
const ROLES: Role[] = ["Operator", "Floor Lead", "TCM", "Flow Ops", "HR", "Coach", "Recruiter"];

function RecruitingPage() {
  return (
    <RoleGate allow={["leadership", "hr", "recruiter"]}>
      <Body />
    </RoleGate>
  );
}

function Body() {
  const candidates = useCandidates();
  const stats = useMemo(() => pipelineStats(), [candidates]);
  const { actor } = useAttendanceState();
  const [openId, setOpenId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<CandidateStage | "active">("active");

  const visible = useMemo(() => {
    if (stageFilter === "active")
      return candidates.filter((c) => c.stage !== "rejected" && c.stage !== "hired");
    return candidates.filter((c) => c.stage === stageFilter);
  }, [candidates, stageFilter]);

  const byStage = useMemo(() => {
    const map: Record<CandidateStage, Candidate[]> = {
      applied: [],
      screen: [],
      interview: [],
      offer: [],
      hired: [],
      rejected: [],
    };
    for (const c of visible) map[c.stage].push(c);
    return map;
  }, [visible]);

  const opened = openId ? candidates.find((c) => c.id === openId) : null;

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1500px] mx-auto">
      <header className="mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
            Talent Funnel
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">
            Recruiting Pipeline
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Source → Screen → Interview → Offer → Hired. Move fast, stay specific.
          </p>
        </div>
        <button
          onClick={() => setComposerOpen(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add candidate
        </button>
      </header>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Active" value={stats.active} />
        <Stat label="In Interview" value={stats.interview} accent />
        <Stat label="Offers Out" value={stats.offer} />
        <Stat label="Hired · 30d" value={stats.hiredLast30} good />
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {(["active", ...CAND_STAGE_ORDER] as const).map((s) => {
          const count =
            s === "active"
              ? candidates.filter((c) => c.stage !== "rejected" && c.stage !== "hired").length
              : candidates.filter((c) => c.stage === s).length;
          return (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border capitalize transition-colors ${
                stageFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "active" ? "Active" : CAND_STAGE_LABEL[s]}{" "}
              <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Kanban */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {CAND_STAGE_ORDER.map((stage) => (
          <div
            key={stage}
            className="rounded-xl bg-muted/40 border border-border p-2 min-h-[120px]"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {CAND_STAGE_LABEL[stage]}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {byStage[stage].length}
              </span>
            </div>
            <div className="space-y-2">
              {byStage[stage].map((c) => (
                <CandidateCard key={c.id} c={c} onOpen={() => setOpenId(c.id)} actorId={actor.id} />
              ))}
              {byStage[stage].length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-3 px-2">Empty</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {composerOpen && <ComposerModal onClose={() => setComposerOpen(false)} actorId={actor.id} />}
      {opened && <DetailModal c={opened} onClose={() => setOpenId(null)} actorId={actor.id} />}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  good,
}: {
  label: string;
  value: number;
  accent?: boolean;
  good?: boolean;
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`font-display text-2xl font-semibold mt-0.5 ${accent ? "text-primary" : good ? "text-success" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function CandidateCard({
  c,
  onOpen,
  actorId,
}: {
  c: Candidate;
  onOpen: () => void;
  actorId: string;
}) {
  function nextStage() {
    const idx = CAND_STAGE_ORDER.indexOf(c.stage);
    const next = CAND_STAGE_ORDER[idx + 1];
    if (next && next !== "rejected") moveCandidate(c.id, next, actorId);
  }
  return (
    <div className="rounded-lg bg-card border border-border p-3 hover:border-primary/40 transition-colors">
      <button onClick={onOpen} className="text-left w-full">
        <div className="flex items-start gap-2">
          <Avatar name={c.name} size={32} />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{c.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {c.roleApplied} · {c.source}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: c.rating }).map((_, i) => (
              <Star key={i} className="h-2.5 w-2.5 fill-warning text-warning" />
            ))}
          </div>
        </div>
        {c.nextStepLabel && c.nextStepAt && (
          <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-primary inline-flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" /> {c.nextStepLabel}
          </div>
        )}
      </button>
      {c.stage !== "hired" && c.stage !== "rejected" && (
        <button
          onClick={nextStage}
          className="mt-2 w-full text-[11px] font-medium py-1 rounded bg-secondary hover:bg-secondary/70 text-secondary-foreground"
        >
          Advance →
        </button>
      )}
    </div>
  );
}

function ComposerModal({ onClose, actorId }: { onClose: () => void; actorId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleApplied, setRoleApplied] = useState<Role>("Operator");
  const [source, setSource] = useState<CandidateSource>("LinkedIn");
  const [expectedSalary, setExpectedSalary] = useState("30000");
  const [experience, setExperience] = useState("");
  const [city, setCity] = useState("Mumbai");

  function submit() {
    if (!name.trim()) return;
    addCandidate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      roleApplied,
      source,
      rating: 3,
      recruiterId: actorId,
      expectedSalary: parseInt(expectedSalary, 10) || 0,
      experience,
      city,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold mb-3">Add candidate</h2>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-background border border-input text-sm"
            />
          </Field>
          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-background border border-input text-sm"
            />
          </Field>
          <Field label="Email" full>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-background border border-input text-sm"
            />
          </Field>
          <Field label="Role">
            <Select value={roleApplied} onValueChange={(v) => setRoleApplied(v as Role)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Source">
            <Select value={source} onValueChange={(v) => setSource(v as CandidateSource)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Expected (₹/mo)">
            <input
              type="number"
              value={expectedSalary}
              onChange={(e) => setExpectedSalary(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-background border border-input text-sm"
            />
          </Field>
          <Field label="City">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-background border border-input text-sm"
            />
          </Field>
          <Field label="Experience" full>
            <input
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. 2 yrs · NoBroker"
              className="w-full h-9 px-3 rounded-md bg-background border border-input text-sm"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            Add to pipeline
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function DetailModal({
  c,
  onClose,
  actorId,
}: {
  c: Candidate;
  onClose: () => void;
  actorId: string;
}) {
  const [note, setNote] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function add() {
    if (!note.trim()) return;
    addCandidateNote(c.id, actorId, note.trim());
    setNote("");
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
        <div className="flex items-start gap-3 mb-4">
          <Avatar name={c.name} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-xl font-semibold">{c.name}</h2>
              <span
                className={`text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border ${stageColor(c.stage)}`}
              >
                {CAND_STAGE_LABEL[c.stage]}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {c.roleApplied} · {c.source} ·{" "}
              <span className="inline-flex items-center gap-0.5">
                {Array.from({ length: c.rating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-warning text-warning inline" />
                ))}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <Info icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={c.phone} />
          <Info icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={c.email} />
          <Info
            icon={<Briefcase className="h-3.5 w-3.5" />}
            label="Experience"
            value={c.experience}
          />
          <Info icon={<MapPin className="h-3.5 w-3.5" />} label="City" value={c.city} />
          <Info
            icon={<IndianRupee className="h-3.5 w-3.5" />}
            label="Expected"
            value={`₹${c.expectedSalary.toLocaleString("en-IN")}/mo`}
          />
          {c.nextStepLabel && (
            <Info
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Next step"
              value={`${c.nextStepLabel}${c.nextStepAt ? ` · ${new Date(c.nextStepAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}`}
            />
          )}
        </div>

        {/* Stage controls */}
        <section className="mb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Move to stage
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CAND_STAGE_ORDER.filter((s) => s !== "rejected").map((s) => (
              <button
                key={s}
                onClick={() => moveCandidate(c.id, s, actorId)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                  c.stage === s
                    ? stageColor(s)
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {CAND_STAGE_LABEL[s]}
              </button>
            ))}
          </div>
        </section>

        {c.rejectReason && (
          <div className="mb-4 rounded-md bg-destructive/5 border border-destructive/20 p-3 text-sm">
            <div className="text-[10px] font-mono uppercase tracking-widest text-destructive mb-0.5">
              Rejected
            </div>
            {c.rejectReason}
          </div>
        )}

        {/* Notes */}
        <section className="mb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Notes
          </div>
          <div className="space-y-2 mb-2">
            {c.notes.length === 0 && (
              <div className="text-xs text-muted-foreground">No notes yet.</div>
            )}
            {c.notes.map((n) => (
              <div key={n.id} className="rounded-md bg-muted/50 border border-border p-2 text-sm">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                  {new Date(n.ts).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                {n.body}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Add a note (be specific — what changed your read?)"
              className="flex-1 h-9 px-3 rounded-md bg-background border border-input text-sm"
            />
            <button onClick={add} className="px-3 h-9 rounded-md bg-secondary text-sm font-medium">
              Add
            </button>
          </div>
        </section>

        {/* Reject zone */}
        <section className="mb-2 pt-3 border-t border-border">
          {!rejectMode ? (
            c.stage !== "rejected" && (
              <button
                onClick={() => setRejectMode(true)}
                className="text-xs text-destructive hover:underline"
              >
                Reject candidate
              </button>
            )
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase tracking-widest text-destructive">
                Rejection reason
              </div>
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="One specific reason."
                className="w-full h-9 px-3 rounded-md bg-background border border-input text-sm"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setRejectMode(false)}
                  className="px-3 py-1.5 text-xs rounded-md hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (rejectReason.trim()) {
                      rejectCandidate(c.id, rejectReason.trim(), actorId);
                      onClose();
                    }
                  }}
                  className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground font-medium"
                >
                  Confirm reject
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="flex justify-between items-center pt-3 border-t border-border">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> Fit-score coming soon
          </div>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="mt-0.5 truncate">{value}</div>
    </div>
  );
}
