import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Target,
  Plus,
  Search,
  Edit2,
  Archive,
  History,
  CheckCircle,
  AlertTriangle,
  Globe,
  MapPin,
  Users,
  User,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { hasKpiCapability } from "@/lib/permissions";
import { useAttendanceState } from "@/hooks/useAttendance";
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
import { store as zoneStore } from "@/lib/zones-store";
import { fetchWorkforce, type WorkforceRow } from "@/lib/workforce-api";
import { Employee } from "@/types/hr";
import {
  fetchKpiDefinitions,
  createKpiDefinition,
  updateKpiDefinition,
  archiveKpiDefinition,
  fetchKpiTargets,
  createKpiTarget,
  updateKpiTarget,
  type KpiDefinition,
  type KpiTarget,
  type KpiScopeType,
} from "@/lib/kpi-governance-api";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/admin/kpis")({
  component: KpiGovernancePage,
});

function KpiGovernancePage() {
  usePageTour("kpi_governance_tour", [
    {
      popover: {
        title: "KPI Governance",
        description: "Welcome to KPI Governance. Here you can define organizational metrics and set targets at the company, zone, or individual level.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-kpi-tabs",
      popover: { title: "Manage Definitions & Targets", description: "Switch between managing KPI definitions and assigning their target values.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-kpi-create",
      popover: { title: "Create Metric", description: "Create a new KPI definition or set a new target.", side: "bottom", align: "start" }
    }
  ]);

  const { actor } = useAttendanceState();
  const [activeTab, setActiveTab] = useState<"definitions" | "targets">("definitions");

  const isAllowed = hasKpiCapability(actor, "view_kpi_governance");

  if (actor.id === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground gap-2">
        <Activity className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-mono uppercase tracking-widest">Loading governance…</span>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="font-display text-xl font-semibold">Access Denied</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You do not have permissions to access the KPI Governance and Configuration console.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              KPI Governance & Targets
            </h1>
            <p className="text-xs text-muted-foreground">
              Define key metrics, assign governance ownership, and set targets
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div id="tour-kpi-tabs" className="flex items-center gap-1 bg-secondary/30 p-1 rounded-lg border border-border self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("definitions")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono uppercase tracking-wider transition ${
              activeTab === "definitions"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Definitions
          </button>
          <button
            onClick={() => setActiveTab("targets")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono uppercase tracking-wider transition ${
              activeTab === "targets"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Targets Config
          </button>
        </div>
      </div>

      {activeTab === "definitions" ? (
        <KpiDefinitionsTab actor={actor} />
      ) : (
        <KpiTargetsTab actor={actor} />
      )}
    </div>
  );
}

// ==========================================
// 1. KPI DEFINITIONS TAB
// ==========================================

function KpiDefinitionsTab({ actor }: { actor: Employee }) {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KpiDefinition | null>(null);
  const [auditKpi, setAuditKpi] = useState<KpiDefinition | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Operations");
  const [unit, setUnit] = useState("count");
  const [frequency, setFrequency] = useState("daily");
  const [aggregationType, setAggregationType] = useState("sum");
  const [visibilityScope, setVisibilityScope] = useState("public");
  const [ownerRole, setOwnerRole] = useState("Operator");
  const [targetType, setTargetType] = useState("min");

  const canManageDefs = hasKpiCapability(actor, "manage_kpi_definitions");

  const loadKpis = async () => {
    setLoading(true);
    try {
      const res = await fetchKpiDefinitions();
      if (res && res.definitions) {
        setKpis(res.definitions);
      }
    } catch (err: any) {
      toast.error("Failed to load KPI definitions: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKpis();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) {
      toast.error("Name and Slug are required.");
      return;
    }
    try {
      const res = await createKpiDefinition({
        name,
        slug,
        description,
        category,
        unit,
        frequency,
        aggregationType,
        visibilityScope,
        ownerRole,
        targetType,
      });
      if (res.ok) {
        toast.success("KPI Definition created successfully.");
        setShowCreate(false);
        // Clear
        setName("");
        setSlug("");
        setDescription("");
        loadKpis();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create definition.");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKpi) return;
    try {
      const res = await updateKpiDefinition(editingKpi.id, {
        name,
        description,
        category,
        unit,
        frequency,
        aggregationType,
        visibilityScope,
        ownerRole,
        targetType,
      });
      if (res.ok) {
        toast.success("KPI Definition updated successfully.");
        setEditingKpi(null);
        loadKpis();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update definition.");
    }
  };

  const handleArchive = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to archive this KPI? Historical values remain intact, but it cannot receive new targets or updates.",
      )
    ) {
      return;
    }
    try {
      const res = await archiveKpiDefinition(id);
      if (res.ok) {
        toast.success("KPI Definition archived successfully.");
        loadKpis();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to archive definition.");
    }
  };

  const filteredKpis = useMemo(() => {
    return kpis.filter((k) => {
      const matchesSearch =
        k.name.toLowerCase().includes(search.toLowerCase()) ||
        k.slug.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || k.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [kpis, search, categoryFilter]);

  const categories = useMemo(() => {
    const set = new Set(kpis.map((k) => k.category));
    return Array.from(set).filter(Boolean);
  }, [kpis]);

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search definitions by name or slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canManageDefs && (
          <Button
            id="tour-kpi-create"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" /> Create KPI
          </Button>
        )}
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="py-20 text-center flex items-center justify-center gap-2">
          <Activity className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground font-mono uppercase">
            Syncing Definitions…
          </span>
        </div>
      ) : filteredKpis.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground max-w-xl mx-auto space-y-3">
          <Target className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <div className="text-sm font-semibold">No KPI Definitions Found</div>
          <p className="text-xs">Archive parameters or refine search to see results.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredKpis.map((k) => (
            <div
              key={k.id}
              className={`rounded-2xl border bg-card p-5 space-y-4 flex flex-col justify-between transition-all ${
                !k.active
                  ? "border-border/40 opacity-70 bg-secondary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground line-clamp-1">{k.name}</h3>
                    <code className="text-[10px] font-mono text-muted-foreground block">
                      {k.slug}
                    </code>
                  </div>
                  <Badge
                    variant={k.active ? "outline" : "secondary"}
                    className={
                      k.active ? "border-success/30 bg-success/15 text-success font-semibold" : ""
                    }
                  >
                    {k.active ? "Active" : "Archived"}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 h-8">
                  {k.description || "No description provided."}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono border-t border-border/40">
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <span className="text-foreground block">{k.category}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Frequency:</span>
                    <span className="text-foreground block uppercase">{k.frequency}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Aggregation:</span>
                    <span className="text-foreground block uppercase">{k.aggregationType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Visibility:</span>
                    <span className="text-foreground block uppercase">{k.visibilityScope}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-auto">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground border border-border">
                    v{k.version}
                  </span>
                  <button
                    onClick={() => setAuditKpi(k)}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                    title="View Change History"
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>
                </div>

                {canManageDefs && k.active && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingKpi(k);
                        setName(k.name);
                        setDescription(k.description || "");
                        setCategory(k.category);
                        setUnit(k.unit);
                        setFrequency(k.frequency);
                        setAggregationType(k.aggregationType);
                        setVisibilityScope(k.visibilityScope);
                        setOwnerRole(k.ownerRole);
                        setTargetType(k.targetType);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded bg-secondary hover:bg-secondary/70 border border-border text-foreground transition"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleArchive(k.id)}
                      className="p-1.5 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition"
                      title="Archive KPI"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create KPI Definition</DialogTitle>
            <DialogDescription>
              Define a new performance standard metric to track.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="create-name">Metric Name</Label>
              <Input
                id="create-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_"));
                }}
                placeholder="e.g. Conversion %"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-slug">Slug Identifier (Unique)</Label>
              <Input
                id="create-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. conversion_rate"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-desc">Description</Label>
              <Input
                id="create-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what is measured..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Attendance">Attendance</SelectItem>
                    <SelectItem value="Collections">Collections</SelectItem>
                    <SelectItem value="Recruiting">Recruiting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Count (Raw)</SelectItem>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="currency">Currency (INR)</SelectItem>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Aggregation</Label>
                <Select value={aggregationType} onValueChange={setAggregationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="average">Average</SelectItem>
                    <SelectItem value="max">Maximum</SelectItem>
                    <SelectItem value="min">Minimum</SelectItem>
                    <SelectItem value="last">Last Logged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Visibility</Label>
                <Select value={visibilityScope} onValueChange={setVisibilityScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="team">Team Only</SelectItem>
                    <SelectItem value="leadership">Leadership Only</SelectItem>
                    <SelectItem value="hr">HR Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Target Type</Label>
                <Select value={targetType} onValueChange={setTargetType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="min">Minimum Goal</SelectItem>
                    <SelectItem value="max">Maximum Cap</SelectItem>
                    <SelectItem value="exact">Exact Target</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Metric</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={!!editingKpi} onOpenChange={() => setEditingKpi(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit KPI Definition</DialogTitle>
            <DialogDescription>
              Updating definition attributes increments version logs.
            </DialogDescription>
          </DialogHeader>
          {editingKpi && (
            <form onSubmit={handleUpdate} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Slug Identifier (Read-only)</Label>
                <Input value={editingKpi.slug} disabled className="bg-secondary/40 font-mono" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-name">Metric Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-desc">Description</Label>
                <Input
                  id="edit-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Attendance">Attendance</SelectItem>
                      <SelectItem value="Collections">Collections</SelectItem>
                      <SelectItem value="Recruiting">Recruiting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Unit</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">Count (Raw)</SelectItem>
                      <SelectItem value="percent">Percentage (%)</SelectItem>
                      <SelectItem value="currency">Currency (INR)</SelectItem>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Aggregation</Label>
                  <Select value={aggregationType} onValueChange={setAggregationType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sum">Sum</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                      <SelectItem value="max">Maximum</SelectItem>
                      <SelectItem value="min">Minimum</SelectItem>
                      <SelectItem value="last">Last Logged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Visibility</Label>
                  <Select value={visibilityScope} onValueChange={setVisibilityScope}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="team">Team Only</SelectItem>
                      <SelectItem value="leadership">Leadership Only</SelectItem>
                      <SelectItem value="hr">HR Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Target Type</Label>
                  <Select value={targetType} onValueChange={setTargetType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="min">Minimum Goal</SelectItem>
                      <SelectItem value="max">Maximum Cap</SelectItem>
                      <SelectItem value="exact">Exact Target</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingKpi(null)}>
                  Cancel
                </Button>
                <Button type="submit">Update Definition</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* AUDIT LOG MODAL */}
      <Dialog open={!!auditKpi} onOpenChange={() => setAuditKpi(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit Version Logs</DialogTitle>
            <DialogDescription>
              Governance audit timeline for <strong>{auditKpi?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto space-y-3 pt-3">
            {!auditKpi?.history || auditKpi.history.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">
                No modifications logged. KPI is at initial version v1.
              </div>
            ) : (
              auditKpi.history.map((h: any, index: number) => (
                <div
                  key={index}
                  className="p-3 border border-border rounded-lg space-y-2 bg-secondary/15"
                >
                  <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                    <span>
                      VERSION {h.version} → {h.version + 1}
                    </span>
                    <span>{new Date(h.updatedAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold text-foreground">Author:</span>{" "}
                    <span className="text-muted-foreground">{h.updatedBy}</span>
                  </div>
                  <div className="text-xs space-y-1 border-t border-border/40 pt-1.5 mt-1">
                    {Object.entries(h.changes || {}).map(([key, change]: [string, any]) => (
                      <div key={key} className="flex justify-between text-[11px] font-mono">
                        <span className="text-muted-foreground capitalize">{key}:</span>
                        <span className="text-foreground text-right truncate max-w-[200px]">
                          <span className="text-destructive line-through mr-1.5">
                            {String(change.from)}
                          </span>
                          <span className="text-success">{String(change.to)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setAuditKpi(null)}>
              Close Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// 2. KPI TARGETS TAB
// ==========================================

function KpiTargetsTab({ actor }: { actor: Employee }) {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [targets, setTargets] = useState<KpiTarget[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKpiId, setSelectedKpiId] = useState<string>("all");
  const [showSetTarget, setShowSetTarget] = useState(false);
  const [targetHistoryItem, setTargetHistoryItem] = useState<KpiTarget | null>(null);

  // Form states
  const [kpiId, setKpiId] = useState("");
  const [scopeType, setScopeType] = useState<KpiScopeType>("org");
  const [scopeId, setScopeId] = useState("org");
  const [targetValue, setTargetValue] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [effectiveTo, setEffectiveTo] = useState("2026-12-31");
  const [notes, setNotes] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiRes, targetRes, wfRes] = await Promise.all([
        fetchKpiDefinitions({ active: true }),
        fetchKpiTargets(),
        fetchWorkforce(),
      ]);

      if (kpiRes && kpiRes.definitions) {
        setKpis(kpiRes.definitions);
      }
      if (targetRes && targetRes.targets) {
        setTargets(targetRes.targets);
      }
      if (wfRes && wfRes.items) {
        setWorkforce(wfRes.items);
      }
    } catch (err: any) {
      toast.error("Failed to load targets config: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSetTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kpiId || !scopeType || !scopeId || !targetValue || !effectiveFrom || !effectiveTo) {
      toast.error("All target parameters are required.");
      return;
    }

    try {
      const res = await createKpiTarget({
        kpiId,
        scopeType,
        scopeId,
        targetValue: Number(targetValue),
        effectiveFrom,
        effectiveTo,
        notes,
      });

      if (res.ok) {
        toast.success("KPI Target configured successfully.");
        setShowSetTarget(false);
        setTargetValue("");
        setNotes("");
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to set target.");
    }
  };

  const filteredTargets = useMemo(() => {
    return targets.filter((t) => selectedKpiId === "all" || t.kpiId === selectedKpiId);
  }, [targets, selectedKpiId]);

  const kpiMap = useMemo(() => {
    return new Map(kpis.map((k) => [k.id, k]));
  }, [kpis]);

  const workforceMap = useMemo(() => {
    return new Map(workforce.map((w) => [w.employeeId, w.name]));
  }, [workforce]);

  const getScopeLabel = (scopeType: string, scopeId?: string) => {
    if (scopeType === "org") return "Organization Wide";
    if (scopeType === "zone") return `Zone: ${scopeId}`;
    if (scopeType === "team") return `Squad/Team: ${scopeId}`;
    if (scopeType === "individual") return `Teammate: ${scopeId ? workforceMap.get(scopeId) || scopeId : "Unknown"}`;
    return scopeId;
  };

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-xl">
          <Select value={selectedKpiId} onValueChange={setSelectedKpiId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by KPI Definition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All KPI Metrics</SelectItem>
              {kpis.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.name} ({k.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => setShowSetTarget(true)}
          className="flex items-center gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" /> Set Target
        </Button>
      </div>

      {/* Comparative target list */}
      {loading ? (
        <div className="py-20 text-center flex items-center justify-center gap-2">
          <Activity className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground font-mono uppercase">
            Syncing Targets…
          </span>
        </div>
      ) : filteredTargets.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground max-w-xl mx-auto space-y-3">
          <Target className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <div className="text-sm font-semibold">No Performance Targets Set</div>
          <p className="text-xs">Establish a new target parameter block to define goals.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/20 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  <th className="px-5 py-4 font-semibold">KPI Metric</th>
                  <th className="px-5 py-4 font-semibold">Scope Tier</th>
                  <th className="px-5 py-4 font-semibold">Scope Entity</th>
                  <th className="px-5 py-4 font-semibold text-right">Target Value</th>
                  <th className="px-5 py-4 font-semibold">Effective Range</th>
                  <th className="px-5 py-4 font-semibold">Owner</th>
                  <th className="px-5 py-4 font-semibold text-center">Version</th>
                  <th className="px-5 py-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {filteredTargets.map((t) => {
                  const kpi = kpiMap.get(t.kpiId);
                  const isMin = kpi?.targetType === "min";
                  const unitSymbol =
                    kpi?.unit === "percent" ? "%" : kpi?.unit === "currency" ? " INR" : "";

                  return (
                    <tr key={t.id} className="hover:bg-secondary/15 transition-colors">
                      <td className="px-5 py-4 font-medium text-foreground">
                        {kpi?.name || "Unknown KPI"}
                        <code className="text-[10px] text-muted-foreground block font-mono">
                          {kpi?.slug}
                        </code>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className="capitalize inline-flex items-center gap-1 text-[10px] font-mono"
                        >
                          {t.scopeType === "org" && <Globe className="h-3 w-3 text-primary" />}
                          {t.scopeType === "zone" && <MapPin className="h-3 w-3 text-warning" />}
                          {t.scopeType === "team" && <Users className="h-3 w-3 text-success" />}
                          {t.scopeType === "individual" && (
                            <User className="h-3 w-3 text-blue-400" />
                          )}
                          {t.scopeType}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {getScopeLabel(t.scopeType, t.scopeId)}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-foreground">
                        {isMin ? "≥" : "≤"}
                        {t.targetValue}
                        {unitSymbol}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground font-mono">
                        {t.effectiveFrom} to {t.effectiveTo}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{t.updatedBy}</td>
                      <td className="px-5 py-4 text-center font-mono text-muted-foreground">
                        v{t.version}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => setTargetHistoryItem(t)}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                          title="Target History Logs"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SET TARGET CONFIGURATION MODAL */}
      <Dialog open={showSetTarget} onOpenChange={setShowSetTarget}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Performance Target</DialogTitle>
            <DialogDescription>
              Define quantitative expectations mapped to hierarchical tiers.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSetTarget} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>KPI Metric</Label>
              <Select value={kpiId} onValueChange={setKpiId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Metric" />
                </SelectTrigger>
                <SelectContent>
                  {kpis.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name} ({k.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Target Scope</Label>
                <Select
                  value={scopeType}
                  onValueChange={(val: string) => {
                    setScopeType(val as import("@/types/kpi").KpiScopeType);
                    if (val === "org") setScopeId("org");
                    else if (val === "zone" && zoneStore.read().zones.length > 0) setScopeId(zoneStore.read().zones[0].name);
                    else setScopeId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org">Org Wide</SelectItem>
                    <SelectItem value="zone">Zone Level</SelectItem>
                    <SelectItem value="team">Team / Squad</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Scope Target Entity</Label>
                {scopeType === "org" && (
                  <Input value="Organization Wide" disabled className="bg-secondary/40" />
                )}
                {scopeType === "zone" && (
                  <Select value={scopeId} onValueChange={setScopeId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {zoneStore.read().zones.map((z) => (
                        <SelectItem key={z.id} value={z.name}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {scopeType === "team" && (
                  <Input
                    placeholder="e.g. Squad A"
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                    required
                  />
                )}
                {scopeType === "individual" && (
                  <Select value={scopeId} onValueChange={setScopeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select teammate" />
                    </SelectTrigger>
                    <SelectContent>
                      {workforce.map((w) => (
                        <SelectItem key={w.employeeId} value={w.employeeId}>
                          {w.name} ({w.operationalRole})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Target Numeric Value</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. 90"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Target Unit (Indicator)</Label>
                <div className="py-2.5 px-3 border border-border rounded bg-secondary/30 text-xs text-muted-foreground font-mono">
                  {kpiId ? kpiMap.get(kpiId)?.unit || "raw" : "Select KPI"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Effective To</Label>
                <Input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Governance Notes / Context</Label>
              <Input
                placeholder="Operational purpose, exception guidelines, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowSetTarget(false)}>
                Cancel
              </Button>
              <Button type="submit">Establish Target</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* TARGET AUDIT LOG MODAL */}
      <Dialog open={!!targetHistoryItem} onOpenChange={() => setTargetHistoryItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Target Configuration Timeline</DialogTitle>
            <DialogDescription>
              Historical values audit for target ID: <code>{targetHistoryItem?.id}</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto space-y-3 pt-3">
            {!targetHistoryItem?.history || targetHistoryItem.history.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">
                No adjustments logged. Target is at initial configuration v1.
              </div>
            ) : (
              targetHistoryItem.history.map((h, index) => (
                <div
                  key={index}
                  className="p-3 border border-border rounded-lg space-y-1.5 bg-secondary/15"
                >
                  <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                    <span>VERSION {h.version}</span>
                    <span>{new Date(h.updatedAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-foreground">
                    Target Value: {h.targetValue}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Range: {h.effectiveFrom} to {h.effectiveTo}
                  </div>
                  <div className="text-[11px] border-t border-border/40 pt-1 text-muted-foreground italic">
                    Notes: {h.notes || "None"}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground text-right">
                    By: {h.updatedBy}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setTargetHistoryItem(null)}>
              Close Logs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
