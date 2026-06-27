import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useAttendanceState } from "@/hooks/useAttendance";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/Avatar";
import { Bell, Mail, Calendar, Shield, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

function SettingsPage() {
  const { actor } = useAttendanceState();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[800px] mx-auto">
      <header className="mb-5">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
          Preferences
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Account and notification preferences.</p>
      </header>
      <div className="rounded-2xl bg-card border border-border p-4 md:p-5 mb-4 flex items-center gap-3">
        <Avatar id={actor.id} size={48} />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{actor.name}</div>
          <div className="text-xs text-muted-foreground">
            {actor.role} · {actor.team}
          </div>
          {user?.email && <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>}
        </div>
        <Link to="/score" className="text-xs text-primary hover:underline">
          My score →
        </Link>
      </div>

      <div className="rounded-2xl bg-card border border-border divide-y divide-border mb-4">
        <Toggle icon={Bell} title="Push notifications" sub="Tasks, kudos, approvals" defaultOn />
        <Toggle icon={Mail} title="Daily email digest" sub="Sent 8:00 AM IST" defaultOn />
        <Toggle
          icon={Calendar}
          title="Calendar reminders"
          sub="15 min before any event"
          defaultOn
        />
        <Toggle
          icon={Shield}
          title="Selfie + GPS for clock-in"
          sub="Required for attendance score"
          defaultOn
          locked
        />
        <Toggle icon={Smartphone} title="Field-mode geofence" sub="Notify if outside zone" />
      </div>

      <Button variant="outline" className="w-full sm:w-auto" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Sign out
      </Button>
    </div>
  );
}

function Toggle({
  icon: Icon,
  title,
  sub,
  defaultOn,
  locked,
}: {
  icon: React.ElementType;
  title: string;
  sub: string;
  defaultOn?: boolean;
  locked?: boolean;
}) {
  return (
    <label className="px-4 md:px-5 py-3 flex items-center gap-3 cursor-pointer">
      <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <input
        type="checkbox"
        defaultChecked={defaultOn}
        disabled={locked}
        className="h-4 w-8 appearance-none rounded-full bg-muted checked:bg-primary transition-colors relative cursor-pointer disabled:opacity-50 before:absolute before:top-0.5 before:left-0.5 before:h-3 before:w-3 before:rounded-full before:bg-card before:transition-transform checked:before:translate-x-4"
      />
    </label>
  );
}
