import { useState } from "react";
import { toast } from "sonner";
import { Brain, Zap, Activity, Sparkles, ShieldAlert, Check } from "lucide-react";
import type { Employee } from "@/types/hr";
import { tierOf } from "@/lib/permissions";
import { useTeamIntelligence } from "@/lib/team-intelligence-api";
import { Avatar } from "@/components/Avatar";

export function LeadershipActionsPanel({ actor }: { actor: Employee }) {
  const tier = tierOf(actor);
  const isLeadership = ["leadership", "zone_leader", "hr", "leader"].includes(tier);

  if (!isLeadership) return null;

  return <LeadershipActionsContent actor={actor} />;
}

function LeadershipActionsContent({ actor }: { actor: Employee }) {
  const { data, loading } = useTeamIntelligence();
  const [completedInterventions, setCompletedInterventions] = useState<Record<string, string>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>({});

  const handle1on1 = (empId: string, name: string) => {
    setCompletedInterventions((prev) => ({
      ...prev,
      [empId]: "1on1",
    }));
    toast.success(`1:1 Check-in initiated with ${name}. Priority logged.`);
  };

  const handleEscalate = (empId: string, name: string) => {
    setCompletedInterventions((prev) => ({
      ...prev,
      [empId]: "escalated",
    }));
    toast.success(`Escalated ${name}'s risk flags to HR.`);
  };

  const requestAiSuggestion = (empId: string, name: string, insights: string[]) => {
    const defaultInsight = (insights && insights[0]) || "productivity signals are flagging.";
    const advice = `Focus Suggestion for ${name}: Allocate a 30-min protected block in Sprint 2 or 3 to help resolve: "${defaultInsight}". Keep tracking metrics daily.`;
    setAiSuggestions((prev) => ({
      ...prev,
      [empId]: advice,
    }));
    toast.success(`AI suggestions retrieved for ${name}`);
  };

  // Safe checks for arrays
  const interventionNeeded = data?.interventionNeeded ?? [];
  const health = data?.health ?? {
    total: 0,
    present: 0,
    late: 0,
    leaveRisk: 0,
    burnoutHigh: 0,
    avgCompletion: 100,
  };

  const lowCompletionRate = health.avgCompletion < 70;

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-card to-secondary/20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Operations Command
            </div>
            <h2 className="font-display text-base font-semibold">Leadership Actions</h2>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Intervention Tracking */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Intervention Tracking
          </div>
          {loading ? (
            <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Activity className="h-4 w-4 animate-spin text-primary" />
              Loading operations signals…
            </div>
          ) : interventionNeeded.length === 0 ? (
            <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
              No active team members require intervention today.
            </div>
          ) : (
            <div className="space-y-3">
              {interventionNeeded.map((m) => {
                const status = completedInterventions[m.employeeId];
                const aiSuggestion = aiSuggestions[m.employeeId];

                return (
                  <div
                    key={m.employeeId}
                    className="rounded-lg border border-border bg-card p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar id={m.employeeId} size={28} />
                        <div>
                          <div className="text-sm font-medium">{m.name}</div>
                          <div className="text-[10px] font-mono uppercase text-destructive">
                            {m.burnoutRisk} burnout risk
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        {status ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-success/10 text-success border border-success/20">
                            <Check className="h-3 w-3" />{" "}
                            {status === "1on1" ? "1:1 Initiated" : "Escalated"}
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handle1on1(m.employeeId, m.name)}
                              className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-secondary hover:bg-secondary/70 border border-border transition text-foreground"
                            >
                              1:1 Check-in
                            </button>
                            <button
                              onClick={() => handleEscalate(m.employeeId, m.name)}
                              className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive transition"
                            >
                              Escalate
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => requestAiSuggestion(m.employeeId, m.name, m.insights)}
                          className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition"
                          title="Get AI Coaching Advice"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Insights list */}
                    {m.insights && m.insights.length > 0 && (
                      <div className="text-xs space-y-1 text-muted-foreground border-l border-border pl-3 ml-3">
                        {m.insights.map((ins, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                            <span>{ins}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI Coach recommendation */}
                    {aiSuggestion && (
                      <div className="rounded border border-primary/20 bg-primary/5 p-3 text-xs flex items-start gap-2 animate-fadeIn">
                        <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="font-mono text-[9px] uppercase tracking-widest text-primary block mb-0.5 font-bold">
                            AI Coach Suggestion
                          </span>
                          <span className="text-foreground">{aiSuggestion}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Team Risk Monitoring & Org Performance Signals */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Team Risk Monitoring */}
          <div className="rounded-lg border border-border bg-secondary/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-foreground font-bold">
                Team Risk Monitoring
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">High Burnout Risk</span>
                <span
                  className={`font-mono font-bold ${health.burnoutHigh > 0 ? "text-destructive" : "text-foreground"}`}
                >
                  {health.burnoutHigh}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Late Arrivals Today</span>
                <span
                  className={`font-mono font-bold ${health.late > 0 ? "text-warning" : "text-foreground"}`}
                >
                  {health.late}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Leave Risks</span>
                <span className="font-mono font-bold">{health.leaveRisk}</span>
              </div>
            </div>
          </div>

          {/* Org Performance Signals */}
          <div className="rounded-lg border border-border bg-secondary/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-foreground font-bold">
                Org Performance Signals
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Avg Task Completion</span>
                <span
                  className={`font-mono font-bold ${lowCompletionRate ? "text-destructive" : "text-success"}`}
                >
                  {health.avgCompletion}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Task Target Compliance</span>
                <span
                  className={`font-mono font-bold ${lowCompletionRate ? "text-destructive" : "text-success"}`}
                >
                  {lowCompletionRate ? "Critical" : "Healthy"}
                </span>
              </div>
              <div className="text-[9px] font-mono text-muted-foreground">
                Alert triggered if avg completion drops below 70%
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
