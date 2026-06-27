import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Loader2,
  Search,
  UserPlus,
  ShieldCheck,
  MoreHorizontal,
  KeyRound,
  Ban,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/AdminGate";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABEL } from "@/lib/permissions";
import {
  OPERATIONAL_ROLES,
  approveUser,
  fetchWorkforce,
  inviteEmployee,
  patchEmployeeOrg,
  reactivateUser,
  rejectUser,
  resetUserPassword,
  suspendUser,
  type WorkforceRow,
} from "@/lib/workforce-api";
import { store as zoneStore } from "@/lib/zones-store";
import type { AppRole, Role } from "@/types/hr";
import { ApiError } from "@/lib/api-client";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/admin/workforce")({
  component: () => (
    <AdminGate>
      <WorkforcePage />
    </AdminGate>
  ),
});

const APP_ROLES: AppRole[] = ["admin", "manager", "employee"];
const EXPERIENCE = ["New", "Mid", "Core"] as const;

const STATUS_TONE: Record<string, string> = {
  active: "bg-success/10 text-success border-success/30",
  suspended: "bg-destructive/10 text-destructive border-destructive/30",
  pending: "bg-warning/10 text-warning border-warning/30",
  no_account: "bg-muted text-muted-foreground border-border",
};

function WorkforcePage() {
  const { refreshOrgData } = useAuth();
  const [rows, setRows] = useState<WorkforceRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editRow, setEditRow] = useState<WorkforceRow | null>(null);
  const [approveRow, setApproveRow] = useState<WorkforceRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<{
    name: string;
    email: string;
    role: string;
    temporaryPassword: string;
  } | null>(null);
  const [resetPasswordRow, setResetPasswordRow] = useState<WorkforceRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWorkforce();
      setRows(res.items);
      setMeta(res.meta);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load workforce");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const teams = useMemo(() => {
    const set = new Set(rows.map((r) => r.team).filter(Boolean));
    ["HQ", "Bandra Hub", "Andheri Hub", "Powai Hub"].forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [rows]);

  const managers = useMemo(
    () =>
      rows.filter(
        (r) =>
          ["Admin", "Zone Leader", "Floor Lead", "Coach", "HR", "leadership"].includes(
            r.operationalRole,
          ) ||
          r.appRole === "admin" ||
          r.appRole === "manager" ||
          r.user?.role === "admin",
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      // Hide admin users from workforce list
      if (r.appRole === "admin") return false;
      if (filterStatus !== "all" && r.accountStatus !== filterStatus) return false;
      if (!needle) return true;
      const hay = [
        r.name,
        r.operationalRole,
        r.appRole,
        r.team,
        r.zone,
        r.user?.email,
        r.managerName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, filterStatus]);

  usePageTour("workforce_tour", [
    {
      popover: {
        title: "Workforce Management",
        description: "Welcome to the Workforce Management dashboard. Manage operational roles, app access, and reporting hierarchies here.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-workforce-stats",
      popover: { title: "Workforce Overview", description: "Quickly view your total headcount, active accounts, and pending approvals at a glance.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-workforce-invite",
      popover: { title: "Invite Employee", description: "Bring new members onto the platform.", side: "left", align: "start" }
    },
    {
      element: "#tour-workforce-filters",
      popover: { title: "Filters & Search", description: "Quickly find any employee or filter by their account status.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-workforce-table",
      popover: { title: "Workforce Table", description: "View and manage roles, teams, and access levels for everyone. Click the three dots on the right to edit an employee.", side: "top" }
    }
  ]);

  const afterMutation = async () => {
    await load();
    await refreshOrgData();
  };

  const runAction = async (fn: () => Promise<void>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      await afterMutation();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action failed");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1500px] mx-auto">
      <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
            Organizational Access
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">
            Workforce Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Operational roles, app access, zones, squads, and reporting hierarchy — without
            flattening the arena model.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button id="tour-workforce-invite" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Invite employee
          </Button>
        </div>
      </header>

      <section id="tour-workforce-stats" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat
          label="Workforce"
          value={rows.filter((r) => r.appRole !== "admin").length}
          onClick={() => setFilterStatus("all")}
          isActive={filterStatus === "all"}
        />
        <Stat
          label="Pending approval"
          value={rows.filter((r) => r.appRole !== "admin" && r.accountStatus === "pending").length}
          tone="warning"
          onClick={() => setFilterStatus("pending")}
          isActive={filterStatus === "pending"}
        />
        <Stat
          label="Active accounts"
          value={rows.filter((r) => r.appRole !== "admin" && r.accountStatus === "active").length}
          tone="success"
          onClick={() => setFilterStatus("active")}
          isActive={filterStatus === "active"}
        />
        <Stat
          label="Suspended"
          value={
            rows.filter((r) => r.appRole !== "admin" && r.accountStatus === "suspended").length
          }
          tone="destructive"
          onClick={() => setFilterStatus("suspended")}
          isActive={filterStatus === "suspended"}
        />
      </section>

      <div id="tour-workforce-filters" className="rounded-2xl border border-border bg-card overflow-hidden mb-4">
        <div className="p-3 md:p-4 flex flex-col md:flex-row gap-3 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, role, zone, team, email…"
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Account status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="no_account">No account</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div id="tour-workforce-table" className="rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Operational</th>
              <th className="px-4 py-3">App access</th>
              <th className="px-4 py-3">Zone / Squad</th>
              <th className="px-4 py-3">Reports to</th>
              <th className="px-4 py-3">Login</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((row) => (
              <tr key={row.employeeId} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar id={row.employeeId} name={row.name} size={32} />
                    <div>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {row.experience} · {row.shift}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="font-normal">
                    {row.operationalRole}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`font-normal ${roleTone(row.appRole)}`}>
                    {ROLE_LABEL[row.appRole]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{row.zone}</div>
                  <div className="text-xs">{row.team}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.managerName ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {row.user?.email ?? row.email ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${STATUS_TONE[row.accountStatus]}`}
                  >
                    {row.accountStatus.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    row={row}
                    busy={busy}
                    onEdit={() => setEditRow(row)}
                    onApprove={(r) => setApproveRow(r)}
                    onConfirm={setConfirm}
                    runAction={runAction}
                    onResetPassword={(r) => setResetPasswordRow(r)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No matches.</div>
        )}
      </div>

      {editRow && (
        <EditEmployeeDialog
          row={editRow}
          teams={teams}
          managers={managers}
          open={!!editRow}
          onOpenChange={(o) => !o && setEditRow(null)}
          busy={busy}
          mode="edit"
          onSave={async (patch) => {
            setBusy(true);
            try {
              await patchEmployeeOrg(editRow.employeeId, patch);
              toast.success("Organization updated");
              setEditRow(null);
              await afterMutation();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Update failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {approveRow && (
        <EditEmployeeDialog
          row={approveRow}
          teams={teams}
          managers={managers}
          open={!!approveRow}
          onOpenChange={(o) => !o && setApproveRow(null)}
          busy={busy}
          mode="approve"
          onSave={async (patch) => {
            setBusy(true);
            try {
              if (approveRow.user?.id) {
                await approveUser(approveRow.user.id, patch);
                toast.success("User approved and activated");
              }
              setApproveRow(null);
              await afterMutation();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Approval failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        teams={teams}
        managers={managers}
        busy={busy}
        onSubmit={async (data) => {
          setBusy(true);
          try {
            const res = await inviteEmployee(data);
            setInviteOpen(false);
            setInviteSuccess({
              name: data.name,
              email: data.email,
              role: data.operationalRole,
              temporaryPassword: res.temporaryPassword,
            });
            toast.success(`Invited ${data.name}`);
            await afterMutation();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Invite failed");
          } finally {
            setBusy(false);
          }
        }}
      />

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => confirm && void runAction(confirm.action, "Done")}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InviteSuccessDialog
        invite={inviteSuccess}
        open={!!inviteSuccess}
        onOpenChange={(o) => !o && setInviteSuccess(null)}
      />

      <ResetPasswordDialog
        row={resetPasswordRow}
        open={!!resetPasswordRow}
        onOpenChange={(o) => !o && setResetPasswordRow(null)}
        busy={busy}
        onReset={async (newPassword) => {
          if (!resetPasswordRow?.user?.id) return;
          setBusy(true);
          try {
            await resetUserPassword(resetPasswordRow.user.id, newPassword);
            toast.success("Password reset successful!");
            await afterMutation();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Password reset failed");
            throw e;
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  onClick,
  isActive,
}: {
  label: string;
  value: number;
  tone?: "warning" | "success" | "destructive";
  onClick?: () => void;
  isActive?: boolean;
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/30"
      : tone === "success"
        ? "border-success/30"
        : tone === "destructive"
          ? "border-destructive/30"
          : "";

  const activeClass = isActive ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "";
  const clickableClass = onClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : "";

  return (
    <div
      className={`rounded-2xl border bg-card p-4 ${toneClass} ${activeClass} ${clickableClass}`}
      onClick={onClick}
    >
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function roleTone(appRole: AppRole) {
  if (appRole === "admin") return "border-destructive/30 text-destructive";
  if (appRole === "hr") return "border-warning/30 text-warning";
  if (appRole === "manager") return "border-primary/30 text-primary";
  return "border-info/30 text-info";
}

function RowActions({
  row,
  busy,
  onEdit,
  onApprove,
  onConfirm,
  runAction,
  onResetPassword,
}: {
  row: WorkforceRow;
  busy: boolean;
  onEdit: () => void;
  onApprove: (row: WorkforceRow) => void;
  onConfirm: (c: { title: string; description: string; action: () => Promise<void> }) => void;
  runAction: (fn: () => Promise<void>, msg: string) => Promise<void>;
  onResetPassword: (row: WorkforceRow) => void;
}) {
  const uid = row.user?.id;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {row.accountStatus !== "pending" && (
          <DropdownMenuItem onClick={onEdit}>Edit org & access</DropdownMenuItem>
        )}
        {uid && (
          <>
            <DropdownMenuSeparator />
            {row.accountStatus === "pending" && (
              <DropdownMenuItem onClick={() => onApprove(row)}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Approve & Configure
              </DropdownMenuItem>
            )}
            {row.user?.isApproved && row.accountStatus !== "suspended" && (
              <DropdownMenuItem
                onClick={() =>
                  onConfirm({
                    title: "Reject access?",
                    description: `Revoke approval for ${row.name}. They cannot sign in until re-approved.`,
                    action: () => rejectUser(uid!).then(() => {}),
                  })
                }
              >
                <XCircle className="h-4 w-4 mr-2" /> Reject approval
              </DropdownMenuItem>
            )}
            {row.accountStatus === "suspended" ? (
              <DropdownMenuItem
                onClick={() =>
                  void runAction(() => reactivateUser(uid!).then(() => {}), "Account reactivated")
                }
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Reactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() =>
                  onConfirm({
                    title: "Suspend account?",
                    description: `Block ${row.name} from signing in. Operational data is preserved.`,
                    action: () => suspendUser(uid!).then(() => {}),
                  })
                }
              >
                <Ban className="h-4 w-4 mr-2" /> Suspend
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onResetPassword(row)}>
              <KeyRound className="h-4 w-4 mr-2" /> Reset password
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditEmployeeDialog({
  row,
  teams,
  managers,
  open,
  onOpenChange,
  busy,
  mode = "edit",
  onSave,
}: {
  row: WorkforceRow;
  teams: string[];
  managers: WorkforceRow[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  mode?: "edit" | "approve";
  onSave: (patch: {
    operationalRole: Role;
    appRole: AppRole;
    team: string;
    zone: string;
    managerId: string | null;
    experience: "New" | "Mid" | "Core";
    shift: string;
  }) => Promise<void>;
}) {
  const [operationalRole, setOperationalRole] = useState<Role>(row.operationalRole);
  const [appRole, setAppRole] = useState<AppRole>(row.appRole);
  const [team, setTeam] = useState(row.team);
  const [zoneCategory, setZoneCategory] = useState<string>(() => {
    const z = zoneStore.read().zones.find((z) => z.name === row.zone);
    return z?.type || "PG";
  });
  const [zone, setZone] = useState(() => {
    if (row.zone && row.zone !== "All") return row.zone;
    const firstZone = zoneStore.read().zones.find((z) => z.type === "PG");
    return firstZone ? firstZone.name : "";
  });

  const handleCategoryChange = (val: string) => {
    setZoneCategory(val);
    const firstZone = zoneStore.read().zones.find((z) => z.type === val);
    setZone(firstZone ? firstZone.name : "");
  };
  const [managerId, setManagerId] = useState(row.managerId ?? "none");
  const [experience, setExperience] = useState(row.experience);
  const [shift, setShift] = useState(row.shift);

  const isTopLevel = ["Admin", "Zone Leader", "Owner", "HR"].includes(operationalRole);
  const isValid = Boolean(
    operationalRole &&
    appRole &&
    team &&
    zone &&
    experience &&
    shift &&
    (isTopLevel || managerId !== "none"),
  );
  const disableSave = busy || (mode === "approve" && !isValid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {row.name}
          </DialogTitle>
          <DialogDescription>
            Update operational role, app access, zone, squad, and reporting line.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Operational role">
            <Select value={operationalRole} onValueChange={(v) => setOperationalRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATIONAL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="App access role">
            <Select value={appRole} onValueChange={(v) => setAppRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Zone Category">
              <Select value={zoneCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PG">PG</SelectItem>
                  <SelectItem value="Flat">Flats</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Zone">
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {zoneStore
                    .read()
                    .zones.filter((z) => z.type === zoneCategory)
                    .map((z) => (
                      <SelectItem key={z.id} value={z.name}>
                        {z.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Team / squad">
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reporting manager">
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managers
                    .filter((m) => m.employeeId !== row.employeeId)
                    .map((m) => (
                      <SelectItem key={m.employeeId} value={m.employeeId}>
                        {m.name} · {m.operationalRole}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Experience">
              <Select
                value={experience}
                onValueChange={(v) => setExperience(v as typeof experience)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Shift">
              <Input value={shift} onChange={(e) => setShift(e.target.value)} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={disableSave}
            onClick={() =>
              void onSave({
                operationalRole,
                appRole,
                team,
                zone,
                managerId: managerId === "none" ? null : managerId,
                experience,
                shift,
              })
            }
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "approve" ? (
              "Approve & Activate"
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  teams,
  managers,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teams: string[];
  managers: WorkforceRow[];
  busy: boolean;
  onSubmit: (data: {
    name: string;
    email: string;
    operationalRole: Role;
    appRole: AppRole;
    team: string;
    zone: string;
    managerId?: string | null;
    experience: "New" | "Mid" | "Core";
    shift: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [operationalRole, setOperationalRole] = useState<Role>("Operator");
  const [appRole, setAppRole] = useState<AppRole>("employee");
  const [team, setTeam] = useState(teams[0] ?? "HQ");
  const [zoneCategory, setZoneCategory] = useState<string>("PG");
  const [zone, setZone] = useState(() => {
    const firstZone = zoneStore.read().zones.find((z) => z.type === "PG");
    return firstZone ? firstZone.name : "";
  });
  const [managerId, setManagerId] = useState("none");

  const handleCategoryChange = (val: string) => {
    setZoneCategory(val);
    const firstZone = zoneStore.read().zones.find((z) => z.type === val);
    setZone(firstZone ? firstZone.name : "");
  };

  const reset = () => {
    setName("");
    setEmail("");
    setOperationalRole("Operator");
    setAppRole("employee");
    setTeam(teams[0] ?? "HQ");
    setZoneCategory("PG");
    const firstZone = zoneStore.read().zones.find((z) => z.type === "PG");
    setZone(firstZone ? firstZone.name : "");
    setManagerId("none");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite employee</DialogTitle>
          <DialogDescription>
            Creates employee profile + auth account with an auto-generated onboarding password.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Work email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Operational role">
            <Select value={operationalRole} onValueChange={(v) => setOperationalRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATIONAL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="App access role">
            <Select value={appRole} onValueChange={(v) => setAppRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Zone Category">
              <Select value={zoneCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PG">PG</SelectItem>
                  <SelectItem value="Flat">Flats</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Zone">
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {zoneStore
                    .read()
                    .zones.filter((z) => z.type === zoneCategory)
                    .map((z) => (
                      <SelectItem key={z.id} value={z.name}>
                        {z.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Team / squad">
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reporting manager">
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.employeeId} value={m.employeeId}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || !name.trim() || !email.trim()}
            onClick={() =>
              void onSubmit({
                name: name.trim(),
                email: email.trim(),
                operationalRole,
                appRole,
                team,
                zone,
                managerId: managerId === "none" ? null : managerId,
                experience: "Mid",
                shift: "10:00 - 19:00",
              })
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function InviteSuccessDialog({
  invite,
  open,
  onOpenChange,
}: {
  invite: {
    name: string;
    email: string;
    role: string;
    temporaryPassword: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);

  if (!invite) return null;

  const inviteDetails = `Gharpayy Arena Invitation
-------------------------
Name: ${invite.name}
Email: ${invite.email}
Role: ${invite.role}
Temporary Password: ${invite.temporaryPassword}
Login URL: ${window.location.origin}/login`;

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(invite.temporaryPassword);
      setCopiedPassword(true);
      toast.success("Password copied to clipboard!");
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      toast.error("Failed to copy password");
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(inviteDetails);
      setCopiedDetails(true);
      toast.success("All credentials copied!");
      setTimeout(() => setCopiedDetails(false), 2000);
    } catch {
      toast.error("Failed to copy details");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl font-display">
            Employee Invited Successfully
          </DialogTitle>
          <DialogDescription className="text-center">
            {invite.name} has been added to the workforce. Share these credentials securely with
            them.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-4 rounded-xl border bg-muted/30 p-4 text-sm font-sans">
          <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-border/50">
            <span className="text-muted-foreground font-medium">Name:</span>
            <span className="col-span-2 text-foreground font-semibold">{invite.name}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-border/50">
            <span className="text-muted-foreground font-medium">Email:</span>
            <span className="col-span-2 text-foreground font-mono select-all break-all">
              {invite.email}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-border/50">
            <span className="text-muted-foreground font-medium">Role:</span>
            <span className="col-span-2 text-foreground font-semibold capitalize">
              {invite.role}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 py-1.5">
            <span className="text-muted-foreground font-medium flex items-center">Password:</span>
            <div className="col-span-2 flex items-center gap-2">
              <span className="font-mono text-emerald-500 font-bold text-lg select-all bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/20">
                {invite.temporaryPassword}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted"
                onClick={copyPassword}
                title="Copy temporary password"
              >
                {copiedPassword ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3 text-xs text-amber-500/90 leading-relaxed flex items-start gap-2.5">
          <KeyRound className="h-4 w-4 shrink-0 mt-0.5 font-bold" />
          <span>
            <strong>First Login Forced Action:</strong> The employee is required to change this
            password immediately upon their first login to gain access.
          </span>
        </div>

        <DialogFooter className="mt-2 flex sm:flex-row gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="flex-1 flex items-center justify-center gap-1.5"
            onClick={copyAll}
          >
            {copiedDetails ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy Onboarding Details
          </Button>
          <Button type="button" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  row,
  open,
  onOpenChange,
  busy,
  onReset,
}: {
  row: WorkforceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onReset: (newPassword: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"default" | "custom">("default");
  const [customPassword, setCustomPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Reset internal states on open
  useEffect(() => {
    if (open) {
      setMode("default");
      setCustomPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setCopiedPassword(false);
    }
  }, [open]);

  if (!row) return null;

  // Validation checks for custom mode
  const hasMinLength = customPassword.length >= 8;
  const matches = customPassword === confirmPassword && confirmPassword.length > 0;
  const isValid = mode === "default" || (hasMinLength && matches);

  const handleGeneratePassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,./?";
    const allChars = uppercase + lowercase + numbers + symbols;

    let generated = "";
    generated += uppercase[Math.floor(Math.random() * uppercase.length)];
    generated += lowercase[Math.floor(Math.random() * lowercase.length)];
    generated += numbers[Math.floor(Math.random() * numbers.length)];
    generated += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 0; i < 10; i++) {
      generated += allChars[Math.floor(Math.random() * allChars.length)];
    }

    generated = generated
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");

    setCustomPassword(generated);
    setConfirmPassword(generated);
    toast.success("Strong password generated!");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customPassword);
      setCopiedPassword(true);
      toast.success("Password copied to clipboard!");
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      toast.error("Failed to copy password");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || busy) return;

    const passwordToUse = mode === "default" ? "Demo@123" : customPassword;
    try {
      await onReset(passwordToUse);
      onOpenChange(false);
    } catch {
      // API call error already handled/displayed by toast in parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <KeyRound className="h-5 w-5 text-primary" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Choose a reset method for <strong>{row.name}</strong> ({row.user?.email || row.email}).
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg text-xs font-medium my-2">
          <button
            type="button"
            className={`py-2 px-3 rounded-md transition-all text-center ${
              mode === "default"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("default")}
          >
            Reset to Default
          </button>
          <button
            type="button"
            className={`py-2 px-3 rounded-md transition-all text-center ${
              mode === "custom"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("custom")}
          >
            Custom Password
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {mode === "default" ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4 text-center space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Default Onboarding Password
                </div>
                <div className="font-mono text-2xl font-extrabold text-primary select-all">
                  Demo@123
                </div>
                <p className="text-xs text-muted-foreground">
                  This standard password is easy to share for dev/demo purposes.
                </p>
              </div>

              <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3.5 text-xs text-amber-500/90 leading-relaxed flex items-start gap-2.5">
                <KeyRound className="h-4 w-4 shrink-0 mt-0.5 animate-pulse" />
                <span>
                  <strong>Forced Password Change:</strong> Using the default onboarding password
                  will flag the user's account to require an immediate password change on next
                  login.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Custom password inputs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dialog-custom-password">New Password</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-primary"
                    onClick={handleGeneratePassword}
                  >
                    Generate Password
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="dialog-custom-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="pr-10 font-mono"
                  />
                  <div className="absolute right-0 top-0 h-full flex items-center pr-3 gap-1.5">
                    {customPassword && (
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                        title="Copy password"
                      >
                        {copiedPassword ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dialog-confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="dialog-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retype password"
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-0 h-full flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Requirement Indicators */}
              <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2 text-xs">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                  Validation
                </div>
                <div
                  className={`flex items-center gap-2 ${hasMinLength ? "text-emerald-500 font-medium" : "text-muted-foreground"}`}
                >
                  {hasMinLength ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  )}
                  <span>At least 8 characters</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${matches ? "text-emerald-500 font-medium" : "text-muted-foreground"}`}
                >
                  {matches ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  )}
                  <span>Passwords match</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Resetting...
                </>
              ) : (
                "Confirm Reset"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
