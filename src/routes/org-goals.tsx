import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, ExternalLink, LogIn } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { Avatar } from "@/components/Avatar";
import { api, impersonate, getCachedUser } from "@/lib/api-client";

export const Route = createFileRoute("/org-goals")({
  component: () => (
    <RoleGate allow={["leadership", "hr"]}>
      <OrgGoalsPage />
    </RoleGate>
  ),
});

interface OrgGoalMetric {
  id: string;
  name: string;
  role: string;
  team: string;
  appRole: string;
  avatarColor?: string;
  metrics: {
    attendance: number;
    tasks: number;
    roleKpi: number;
    total: number;
    tier: string;
    flags: string[];
  };
}

function OrgGoalsPage() {
  const navigate = useNavigate();
  const currentUser = getCachedUser();
  const isAdmin = currentUser?.role === "admin";

  const { data, isLoading, error } = useQuery<OrgGoalMetric[]>({
    queryKey: ["org-goals"],
    queryFn: async () => {
      return api.get<OrgGoalMetric[]>("/org-goals");
    },
  });

  const sortedData = (data || []).sort((a, b) => b.metrics.total - a.metrics.total);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-4 transition-colors">
          &larr; Back to Dashboard
        </Link>
        <div className="text-xs font-mono uppercase tracking-widest text-primary mb-2">
          Org-Wide Performance
        </div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Org Goals</h1>
        <p className="text-muted-foreground mt-1">
          Detailed metrics and goal attainment for every individual across the organization.
        </p>
      </header>

      {isLoading ? (
        <div className="flex h-[40vh] items-center justify-center border rounded-xl bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-destructive border rounded-xl bg-card">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Error loading org goals data.</p>
          <p className="text-xs opacity-70 mt-2">{String(error)}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm text-left">

          <thead className="bg-muted/30 text-muted-foreground text-xs font-mono uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium text-right">Attendance</th>
              <th className="px-4 py-3 font-medium text-right">Tasks</th>
              <th className="px-4 py-3 font-medium text-right">Role KPI</th>
              <th className="px-4 py-3 font-medium text-right">Score</th>
              <th className="px-4 py-3 font-medium text-center">Tier</th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedData.map((emp, i) => (
              <tr key={emp.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  #{i + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar id={emp.id} size={32} />
                    <div>
                      <div className="font-medium text-foreground">{emp.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {emp.role} · {emp.team}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {emp.metrics.attendance}%
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {emp.metrics.tasks}%
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {emp.metrics.roleKpi}%
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-primary">
                  {emp.metrics.total}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center justify-center h-6 w-6 rounded border font-mono font-bold text-xs ${
                    emp.metrics.tier === "A" ? "bg-success/10 text-success border-success/30" :
                    emp.metrics.tier === "B" ? "bg-primary/10 text-primary border-primary/30" :
                    emp.metrics.tier === "C" ? "bg-warning/10 text-warning border-warning/30" :
                    "bg-destructive/10 text-destructive border-destructive/30"
                  }`}>
                    {emp.metrics.tier}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {emp.metrics.flags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {emp.metrics.flags.map((f, i) => (
                        <span key={i} className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground opacity-50">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin ? (
                    <button
                      onClick={async () => {
                        try {
                          await impersonate(emp.id);
                          window.location.replace("/"); // Replace history state so back button doesn't hit /org-goals
                        } catch (err) {
                          alert("Failed to impersonate user");
                        }
                      }}
                      className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition-colors"
                    >
                      Impersonate
                      <LogIn className="h-3 w-3 ml-1.5 opacity-70" />
                    </button>
                  ) : (
                    <Link
                      to="/people"
                      search={{ q: emp.name }}
                      className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium transition-colors"
                    >
                      Profile
                      <ExternalLink className="h-3 w-3 ml-1.5 opacity-70" />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
