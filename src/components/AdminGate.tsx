import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/permissions";
import { useAttendanceState } from "@/hooks/useAttendance";

/** Restricts routes to platform admins (auth role) with manage_users capability. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const { actor } = useAttendanceState();

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allowed = user?.role === "admin" && actor && can(actor.appRole, "manage_users");

  if (!allowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive mb-4" />
          <h1 className="font-display text-xl font-semibold mb-2">Admin access only</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Workforce access management is restricted to platform administrators.
          </p>
          <Link to="/" className="text-sm text-primary hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
