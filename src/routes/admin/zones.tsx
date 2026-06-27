import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Edit, Map as MapIcon, RefreshCw, Filter, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/AdminGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { store as zoneStore, hydrateZones, createZone, updateZone } from "@/lib/zones-store";
import type { Zone } from "@/data/zones";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/admin/zones")({
  component: () => (
    <AdminGate>
      <ZonesAdminPage />
    </AdminGate>
  ),
});

function ZonesAdminPage() {
  usePageTour("zones_admin_tour", [
    {
      popover: {
        title: "Manage Zones",
        description: "Welcome to Zone Management. From here, Platform Admins can create and edit the geographic operating zones of the company.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-zones-create",
      popover: { title: "Create a Zone", description: "Click here to define a new operational zone.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-zones-filters",
      popover: { title: "Find Zones", description: "Filter zones by city or search for a specific zone by name or ID.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-zones-list",
      popover: { title: "Zones Directory", description: "View all active zones, their assigned Zone Leaders, and edit their details here.", side: "top", align: "start" }
    }
  ]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  

  const [cityFilter, setCityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    await hydrateZones();
    setZones(zoneStore.read().zones);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (data: Partial<Zone>) => {
    setBusy(true);
    try {
      if (isCreating) {
        // Generate a simple ID for new zones
        const id = "z" + Date.now().toString().slice(-4);
        await createZone({ ...data, id });
        toast.success("Zone created");
      } else if (editZone) {
        await updateZone(editZone.id, data);
        toast.success("Zone updated");
      }
      setEditZone(null);
      setIsCreating(false);
      setZones(zoneStore.read().zones);
    } catch (err: any) {
      toast.error(err.message || "Failed to save zone");
    } finally {
      setBusy(false);
    }
  };

  if (loading && zones.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1200px] mx-auto">
      <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5 flex items-center gap-2">
            <MapIcon className="h-3.5 w-3.5" />
            Platform Admin
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">
            Manage Zones
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Create and edit operational zones across the organization.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button
            id="tour-zones-create"
            size="sm"
            onClick={() => {
              setEditZone(null);
              setIsCreating(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create Zone
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div id="tour-zones-filters" className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-[140px]">
            <Select value={cityFilter} onValueChange={(val) => setCityFilter(val)}>
              <SelectTrigger className="h-9 text-xs bg-card">
                <SelectValue placeholder="All cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                {Array.from(new Set(zones.map((z) => z.city).filter(Boolean)))
                  .sort()
                  .map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search zones..."
              className="pl-9 h-9 bg-background"
            />
          </div>
        </div>
      </div>

      <div id="tour-zones-list" className="rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3 text-right">Pods</th>
              <th className="px-4 py-3">Leader ID</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {zones
              .filter((z) => cityFilter === "all" || z.city === cityFilter)
              .filter(
                (z) =>
                  searchQuery.trim() === "" ||
                  z.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  z.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (z.city && z.city.toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .map((zone) => (
              <tr key={zone.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{zone.id}</td>
                <td className="px-4 py-3 font-medium">{zone.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{zone.city}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{zone.pods}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {zone.leaderId || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setIsCreating(false);
                      setEditZone(zone);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                  No zones created yet. Click "Create Zone" to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ZoneDialog
        open={isCreating || !!editZone}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditZone(null);
          }
        }}
        initialData={editZone || { name: "", city: "", pods: 0, leaderId: "" }}
        isCreating={isCreating}
        busy={busy}
        onSave={handleSave}
      />
    </div>
  );
}

function ZoneDialog({
  open,
  onOpenChange,
  initialData,
  isCreating,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: Partial<Zone>;
  isCreating: boolean;
  busy: boolean;
  onSave: (data: Partial<Zone>) => Promise<void>;
}) {
  const [name, setName] = useState(initialData.name || "");
  const [city, setCity] = useState(initialData.city || "");
  const [pods, setPods] = useState(initialData.pods?.toString() || "0");
  const [leaderId, setLeaderId] = useState(initialData.leaderId || "");

  useEffect(() => {
    if (open) {
      setName(initialData.name || "");
      setCity(initialData.city || "");
      setPods(initialData.pods?.toString() || "0");
      setLeaderId(initialData.leaderId || "");
    }
  }, [open, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSave({
      name,
      city,
      pods: parseInt(pods, 10) || 0,
      leaderId,
    });
  };

  const isValid = name.trim().length > 0 && city.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isCreating ? "Create Zone" : "Edit Zone"}</DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Add a new operational zone to the platform."
                : "Update existing zone details."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Zone Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HSR Layout"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bangalore"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leaderId">Leader ID (Employee ID)</Label>
              <Input
                id="leaderId"
                value={leaderId}
                onChange={(e) => setLeaderId(e.target.value)}
                placeholder="e.g. e20"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pods">Number of Pods</Label>
              <Input
                id="pods"
                type="number"
                min="0"
                value={pods}
                onChange={(e) => setPods(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !isValid}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreating ? "Create" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
