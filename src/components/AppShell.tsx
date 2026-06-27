import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Activity,
  Flame,
  Clock4,
  ClipboardList,
  Calendar,
  CheckSquare,
  Trophy,
  Heart,
  Inbox,
  PlaneTakeoff,
  Bell,
  Search,
  Sparkles,
  Award,
  Settings,
  ShieldCheck,
  Menu,
  X,
  MessageSquareText,
  UserPlus,
  UserCog,
  Zap,
  Shield,
  Map as MapIcon,
  Building2,
  Wallet,
  Radio,
  LogOut,
  Target,
  HelpCircle,
  User,
} from "lucide-react";
import { playbookFor } from "@/lib/playbooks-store";
import { shieldNow } from "@/lib/console-store";
import { useAttendanceState } from "@/hooks/useAttendance";
import { liveStatusFor } from "@/lib/attendance-store";
import { useNotifications } from "@/lib/notification-store";
import { bootArena } from "@/lib/seed-init";
import { can, tierOf, TIER_LABEL, type Tier } from "@/lib/permissions";
import { NotificationDropdown } from "./NotificationDropdown";
import { CalendarPeek } from "./CalendarPeek";
import { CommandPalette } from "./CommandPalette";
import { GiveKudoModal } from "./GiveKudoModal";
import { OnboardingTour } from "./OnboardingTour";
import { Avatar } from "./Avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { isImpersonating, revertImpersonation } from "@/lib/api-client";
import { useRoleFeature } from "../hooks/useRoleFeature";
import ComingSoon from "./ComingSoon";
import { requestNotificationPermissionAndGetToken } from "@/lib/firebase";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  tiers: Tier[];
  /** Requires platform admin auth + manage_users capability */
  adminOnly?: boolean;
};

const ALL: Tier[] = [
  "leadership",
  "zone_leader",
  "hr",
  "leader",
  "recruiter",
  "teammate",
  "partner",
];
const INTERNAL: Tier[] = ["leadership", "zone_leader", "hr", "leader", "recruiter", "teammate"];

const NAV: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard, tiers: ALL },
  // Partner-only surface
  { to: "/partner", label: "My Properties", icon: Building2, tiers: ["partner"] },
  // Internal staff
  { to: "/pulse", label: "Daily Pulse", icon: Radio, tiers: INTERNAL },
  { to: "/fly", label: "Fly Board", icon: PlaneTakeoff, tiers: INTERNAL },
  { to: "/zones", label: "Zones", icon: MapIcon, tiers: ["leadership", "zone_leader", "hr"] },
  {
    to: "/console",
    label: "Operator Console",
    icon: Zap,
    tiers: ["leadership", "zone_leader", "hr", "leader", "recruiter", "teammate"],
  },
  { to: "/score", label: "My Score", icon: Trophy, tiers: INTERNAL },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, tiers: INTERNAL },
  { to: "/achievements", label: "Achievements", icon: Award, tiers: INTERNAL },
  { to: "/calendar", label: "Calendar", icon: Calendar, tiers: INTERNAL },
  { to: "/leaves", label: "Leaves", icon: PlaneTakeoff, tiers: INTERNAL },
  { to: "/kudos", label: "Kudos", icon: Heart, tiers: INTERNAL },
  { to: "/inbox", label: "Inbox", icon: Inbox, tiers: ALL },
  { to: "/attendance", label: "Attendance", icon: Clock4, tiers: INTERNAL },
  {
    to: "/one-on-ones",
    label: "Schedule 1:1",
    icon: MessageSquareText,
    tiers: ["leadership", "zone_leader", "hr", "leader", "recruiter"],
  },
  {
    to: "/people",
    label: "People",
    icon: Users,
    tiers: ["leadership", "zone_leader", "hr", "leader"],
  },
  {
    to: "/roster",
    label: "Live Roster",
    icon: ClipboardList,
    tiers: ["leadership", "zone_leader", "hr", "leader"],
  },
  {
    to: "/war-room",
    label: "War Room",
    icon: Activity,
    tiers: ["leadership", "zone_leader", "leader"],
  },
  {
    to: "/command",
    label: "Coach AI",
    icon: MessageSquare,
    tiers: ["leadership"],
    adminOnly: true,
  },
  {
    to: "/recruiting",
    label: "Recruiting",
    icon: UserPlus,
    tiers: ["leadership", "hr", "recruiter"],
  },
  { to: "/hrms", label: "HRMS", icon: ShieldCheck, tiers: ["leadership", "hr"] },
  {
    to: "/admin/workforce",
    label: "Workforce",
    icon: UserCog,
    tiers: ["leadership"],
    adminOnly: true,
  },
  {
    to: "/admin/zones",
    label: "Manage Zones",
    icon: MapIcon,
    tiers: ["leadership"],
    adminOnly: true,
  },
  {
    to: "/admin/kpis",
    label: "KPI Governance",
    icon: Target,
    tiers: ["leadership", "zone_leader", "hr", "leader"],
  },
  {
    to: "/admin/permissions",
    label: "Permissions",
    icon: Shield,
    tiers: ["leadership"],
    adminOnly: true,
  },
];

const MOBILE_NAV_BASE = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/fly", label: "Fly", icon: PlaneTakeoff },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/inbox", label: "Inbox", icon: Bell },
  { to: "/hrms", label: "More", icon: Menu },
];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { actor } = useAttendanceState();
  const { user, logout, switchRole } = useAuth();
  const playbookKey = actor.role ? actor.role.toLowerCase().replace(/\s+/g, "_") : "";
  const hasPlaybook = !!playbookKey && !!playbookFor(playbookKey);
  const shield = hasPlaybook ? shieldNow(actor.id) : { active: false, label: "" };
  const status = liveStatusFor(actor.id);
  const [bellOpen, setBellOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [kudoOpen, setKudoOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const notifications = useNotifications(actor.id);
  const unread = notifications.filter((n) => !n.read && n.actionTo !== "/inbox").length;
  const unreadInbox = notifications.filter((n) => !n.read && n.actionTo === "/inbox").length;
  const tier = tierOf(actor);

  const isFeatureEnabled = useRoleFeature();

  const visibleNav = NAV.filter((item) => isFeatureEnabled(item.to));
  if (tier !== "leadership" && actor.appRole !== "admin") {
    visibleNav.splice(1, 0, {
      to: `/employee/${actor.id}`,
      label: "My Profile",
      icon: User as any,
      tiers: ALL,
    });
  }

  const mobileNav = (
    tier === "partner"
      ? [
          MOBILE_NAV_BASE[0],
          { to: "/partner", label: "Properties", icon: Building2 },
          { to: "/partner", label: "Payouts", icon: Wallet },
          MOBILE_NAV_BASE[3],
          MOBILE_NAV_BASE[4],
        ]
      : tier === "zone_leader"
        ? [
            MOBILE_NAV_BASE[0],
            { to: "/fly", label: "Fly", icon: PlaneTakeoff },
            { to: "/roster", label: "Roster", icon: ClipboardList },
            MOBILE_NAV_BASE[3],
            MOBILE_NAV_BASE[4],
          ]
        : tier === "leadership" || tier === "leader"
          ? [
              MOBILE_NAV_BASE[0],
              MOBILE_NAV_BASE[1],
              { to: "/war-room", label: "War", icon: Activity },
              MOBILE_NAV_BASE[3],
              MOBILE_NAV_BASE[4],
            ]
          : tier === "hr"
            ? [
                MOBILE_NAV_BASE[0],
                { to: "/people", label: "People", icon: Users },
                { to: "/recruiting", label: "Hiring", icon: UserPlus },
                MOBILE_NAV_BASE[3],
                MOBILE_NAV_BASE[4],
              ]
            : tier === "recruiter"
              ? [
                  MOBILE_NAV_BASE[0],
                  { to: "/recruiting", label: "Pipeline", icon: UserPlus },
                  { to: "/one-on-ones", label: "1:1s", icon: MessageSquareText },
                  MOBILE_NAV_BASE[3],
                  MOBILE_NAV_BASE[4],
                ]
              : MOBILE_NAV_BASE
  ).filter((item) => isFeatureEnabled(item.to));

  useEffect(() => {
    bootArena();
  }, []);
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // Automatically try to request or refresh push token 2 seconds after dashboard load
    const timer = setTimeout(() => {
      requestNotificationPermissionAndGetToken().catch(console.error);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusDot =
    status === "Clocked In"
      ? "bg-success"
      : status === "On Break"
        ? "bg-warning"
        : status === "In Field"
          ? "bg-primary"
          : "bg-muted-foreground/40";

  // Render main content – if current route is hidden, show ComingSoon
  const showContent = isFeatureEnabled(location.pathname);
  const Sidebar = (
    <aside
      id="tour-sidebar"
      className="w-60 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-full"
    >
      <div className="px-5 py-4 border-b border-sidebar-border flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/" })}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Flame className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-semibold text-white text-sm tracking-[0.18em]">
              GHARPAYY
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-sidebar-foreground/70">
              Core Arena · v2026
            </div>
          </div>
        </button>
        <button
          onClick={() => setDrawerOpen(false)}
          className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded text-sidebar-foreground/70 hover:bg-sidebar-hover/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {visibleNav.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              id={`tour-nav-${to.replace(/\//g, "").replace(/-/g, "") || "home"}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-hover text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {to === "/inbox" && unreadInbox > 0 && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-bold flex items-center justify-center shadow-sm">
                  {unreadInbox > 99 ? "99+" : unreadInbox}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => {
            setKudoOpen(true);
            setDrawerOpen(false);
          }}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary-foreground/90 text-xs font-medium py-2 rounded-md border border-primary/30"
        >
          <Award className="h-3.5 w-3.5" /> Give a kudo
        </button>
        <div className="flex items-center gap-2 px-2 py-2 mt-2 text-[10px] text-sidebar-foreground/60">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="font-mono uppercase tracking-widest">Gharpayy workspace</span>
        </div>
      </div>
      <div className="p-3 border-t border-sidebar-border mt-auto">
        <div className="flex flex-col gap-3 rounded-xl bg-sidebar-hover/20 p-3 border border-sidebar-border/40 hover:bg-sidebar-hover/40 transition-all duration-300 group">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar id={actor.id} size={36} className="ring-2 ring-background/10 shadow-sm" />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-sidebar ${statusDot}`}
                title={status}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate tracking-tight">
                {actor.name}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/90 font-mono truncate mt-0.5">
                {actor.role}
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate({ to: "/login", replace: true });
                setDrawerOpen(false);
              }}
              className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive text-sidebar-foreground/70 flex items-center justify-center transition-all shrink-0"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-sidebar-border/30">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-[10px] text-sidebar-foreground/70 truncate">
                {user?.email || actor.team}
              </span>
            </div>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary font-mono uppercase tracking-widest text-[9px] shrink-0">
              {TIER_LABEL[tier]}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{Sidebar}</div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-sidebar/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full max-w-[80vw] w-72 animate-in slide-in-from-left duration-200">
            {Sidebar}
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden pb-16 md:pb-0">
        {isImpersonating() && (
          <div className="bg-destructive/15 text-destructive border-b border-destructive/20 text-xs px-4 py-2 flex items-center justify-center gap-2">
            <span className="font-semibold">Impersonation Mode Active</span>
            <span className="text-destructive/80">
              — you are currently viewing the app as {actor.name}.
            </span>
            <button
              onClick={() => {
                revertImpersonation();
                window.location.replace("/");
              }}
              className="ml-2 font-semibold underline underline-offset-2 hover:text-destructive/80"
            >
              Return to Admin
            </button>
          </div>
        )}
        <header className="shrink-0 h-14 border-b border-border bg-card/50 backdrop-blur-md flex items-center px-3 md:px-6 gap-2 md:gap-4 z-40">
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            id="tour-search"
            onClick={() => setPaletteOpen(true)}
            className="flex-1 max-w-md inline-flex items-center gap-2 h-9 px-3 rounded-md bg-secondary/80 border border-border text-sm text-muted-foreground hover:border-primary/40 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Search…</span>
            <kbd className="ml-auto hidden md:inline text-[10px] font-mono bg-background px-1.5 py-0.5 rounded border border-border">
              ⌘K
            </kbd>
          </button>
          {shield.active && (
            <Link
              to="/console"
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/15 border border-primary/30 text-primary text-xs font-mono uppercase tracking-widest hover:bg-primary/25"
              title={shield.label}
            >
              <Shield className="h-3.5 w-3.5" /> Shield Mode
            </Link>
          )}
          <div className="ml-auto flex items-center gap-1 relative">
            <div className="relative hidden sm:block">
              <button
                id="tour-calendar"
                onClick={() => {
                  setCalOpen((v) => !v);
                  setBellOpen(false);
                }}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
                title="Calendar peek"
              >
                <Calendar className="h-4 w-4" />
              </button>
              <CalendarPeek open={calOpen} onClose={() => setCalOpen(false)} />
            </div>
            <div className="relative">
              <button
                id="tour-notifications"
                onClick={() => {
                  setBellOpen((v) => !v);
                  setCalOpen(false);
                }}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary transition-colors relative"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-mono font-bold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              <NotificationDropdown open={bellOpen} onClose={() => setBellOpen(false)} />
            </div>
            {isFeatureEnabled("/settings") && (
              <Link
                to="/settings"
                className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary transition-colors"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  id="tour-profile"
                  className="ml-1 inline-flex items-center gap-2 px-1 sm:px-2 py-1 rounded-md hover:bg-secondary transition-colors text-left focus:outline-none"
                >
                  <Avatar id={actor.id} size={28} />
                  <div className="hidden lg:block">
                    <div className="text-xs font-semibold leading-tight">
                      {actor.name.split(" ")[0]}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
                      {actor.role}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-50">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{actor.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || actor.team}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (window.activeTourFn) window.activeTourFn();
                    else window.dispatchEvent(new Event("start-tour"));
                  }}
                  className="cursor-pointer"
                >
                  <Sparkles className="mr-2 h-4 w-4 text-primary" />
                  <span>Replay Tour</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isFeatureEnabled("/score") && (
                  <DropdownMenuItem asChild>
                    <Link to="/score" className="w-full cursor-pointer flex items-center">
                      <Trophy className="mr-2 h-4 w-4" />
                      <span>My Score</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    navigate({ to: "/login", replace: true });
                    setDrawerOpen(false);
                  }}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="flex-1 min-w-0 overflow-y-auto">
          {showContent ? <Outlet /> : <ComingSoon />}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-card border-t border-border flex">
        {mobileNav.map(({ to, label, icon: Icon }, i) => {
          const isMore = i === mobileNav.length - 1;
          const active = !isMore && location.pathname === to;
          if (isMore) {
            return (
              <button
                key={to}
                onClick={() => setDrawerOpen(true)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground"
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          }
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {to === "/inbox" && unreadInbox > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-3.5 min-w-3.5 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-mono font-bold flex items-center justify-center">
                    {unreadInbox > 9 ? "9+" : unreadInbox}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <GiveKudoModal open={kudoOpen} onClose={() => setKudoOpen(false)} />
      <OnboardingTour />
    </div>
  );
}
