import { Link, useLocation } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { tierOf, TIER_LABEL, type Tier } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleFeature } from "@/hooks/useRoleFeature";

export function RoleGate({ allow, children }: { allow: Tier[]; children: React.ReactNode }) {
  const { actor } = useAuth();
  const location = useLocation();
  const isFeatureEnabled = useRoleFeature();

  if (!actor) return null;

  if (isFeatureEnabled(location.pathname)) return <>{children}</>;

  const tier = tierOf(actor);
  if (allow.includes(tier)) return <>{children}</>;
  return (
    <div className="px-4 md:px-8 py-12 max-w-xl mx-auto">
      <div className="rounded-xl bg-card border border-border p-8 text-center">
        <div className="h-12 w-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          {TIER_LABEL[tier]} access
        </div>
        <h1 className="font-display text-xl font-semibold mb-2">Not your arena — yet</h1>
        <p className="text-sm text-muted-foreground mb-5">
          This view is for: {allow.map((t) => TIER_LABEL[t]).join(", ")}. Your role focuses on a
          different surface, and that's intentional. Go own your day.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
