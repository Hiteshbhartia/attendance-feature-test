import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

export function AuthGate() {
  const { status, apiEnabled, isLoading, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isPublic = PUBLIC_PATHS.has(location.pathname);

  useEffect(() => {
    if (status === "loading") return;

    // Disabled apiEnabled check as auth is mocked
    // if (!apiEnabled && !isPublic) {
    //   navigate({ to: "/login", replace: true });
    //   return;
    // }

    if (status === "authenticated" && isPublic) {
      navigate({ to: "/", replace: true });
      return;
    }

    if (status === "unauthenticated" && !isPublic) {
      navigate({
        to: "/login",
        replace: true,
        search: { redirect: location.pathname },
      });
    }
  }, [status, isPublic, apiEnabled, navigate, location.pathname]);

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-widest">Loading arena…</span>
        </div>
      </div>
    );
  }

  if (isPublic) {
    return <Outlet />;
  }

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
            <ShieldCheck className="h-8 w-8 text-warning" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Pending Approval</h2>
          <p className="text-sm text-muted-foreground">
            Your account is pending approval from administration. You cannot access the dashboard
            until your profile is configured and approved.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (user?.status === "suspended" || user?.isSuspended) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Account Suspended</h2>
          <p className="text-sm text-muted-foreground">
            Your account has been suspended by administration. You no longer have access to the
            dashboard.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (user?.mustChangePassword) {
    if (location.pathname !== "/force-password-reset") {
      navigate({ to: "/force-password-reset", replace: true });
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    return <Outlet />;
  }

  return <AppShell />;
}
