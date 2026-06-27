import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, ShieldAlert, Activity, Check, X, Filter } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getPermissions, updatePermission, type RolePermission } from "@/api/permissions";
import { ENABLED_FEATURES, FEATURE_MAP, ROLE_MATRIX } from "@/config/launch-config";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/admin/permissions")({
  component: PermissionsPage,
});

function PermissionsPage() {
  usePageTour("permissions_admin_tour", [
    {
      popover: {
        title: "Role Permissions",
        description: "Welcome to Permissions Management. Define which roles can access which features across the platform.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-permissions-filters",
      popover: { title: "Filter Categories", description: "Filter the feature list by category (e.g. Daily Operations, Intelligence & Planning).", side: "bottom", align: "start" }
    },
    {
      element: "#tour-permissions-matrix",
      popover: { title: "Permission Matrix", description: "Toggle features on or off for specific roles. Changes take effect immediately.", side: "top", align: "start" }
    }
  ]);

  const { user } = useAuth();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const roles = ["employee", "manager", "hr", "admin"];
  const queryClient = useQueryClient();
  // We collect all possible features from FEATURE_MAP plus explicit ones
  const features = Array.from(
    new Set([
      ...Object.values(FEATURE_MAP),
      "teamIntelligence",
      "leadershipActions",
    ])
  );

  const FEATURE_CATEGORIES: Record<string, string[]> = {
    "All": features,
    "Daily Operations": ["home", "tasks", "taskThroughput", "inbox", "calendar", "coach"],
    "Attendance & Pulse": ["selfieAttendance", "dailyPulse", "liveAttendance"],
    "People & Culture": ["kudos", "oneOnOnes", "hrCapabilities"],
    "Intelligence & Planning": ["flyBoard", "liveRoster", "orgGoals", "teamIntelligence", "leadershipActions"],
    "Admin & Settings": ["kpiGovernance", "manageZones", "workforce", "adminPermissions", "adminFeatures", "operatorConsole"],
  };

  const filteredFeatures = categoryFilter === "All" 
    ? features 
    : features.filter(f => FEATURE_CATEGORIES[categoryFilter]?.includes(f));

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const data = await getPermissions();
      setPermissions(data);
    } catch (err) {
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  const handleToggle = async (role: string, feature: string, currentlyEnabled: boolean) => {
    try {
      const res = await updatePermission(role, feature, !currentlyEnabled);
      if (res) {
        toast.success(`Permission updated for ${role}`);
        setPermissions((prev) => {
          const exists = prev.find((p) => p.role === role && p.feature === feature);
          // Invalidate React Query cache so useRoleFeature fetches fresh data
          queryClient.invalidateQueries({ queryKey: ["permissions", role] });
          queryClient.invalidateQueries({ queryKey: ["permissions"] });
          if (exists) {
            return prev.map((p) =>
              p.role === role && p.feature === feature ? { ...p, enabled: !currentlyEnabled } : p
            );
          } else {
            return [...prev, { role, feature, enabled: !currentlyEnabled }];
          }
        });
      }
    } catch (err) {
      toast.error("Failed to update permission");
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Only platform administrators can manage permissions.</p>
      </div>
    );
  }

  const isFeatureEnabledForRole = (role: string, feature: string) => {
    // Check DB first
    const dbPerm = permissions.find((p) => p.role === role && p.feature === feature);
    if (dbPerm) return dbPerm.enabled;
    // Fallback to defaults
    return ROLE_MATRIX[role]?.includes(feature) || false;
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-5">
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Role Permissions</h1>
          <p className="text-xs text-muted-foreground">
            Manage granular access control for all modules and features.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
          <Activity className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-mono uppercase tracking-widest">Loading matrix...</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div id="tour-permissions-filters" className="w-[200px]">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 text-xs bg-card">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(FEATURE_CATEGORIES).map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div id="tour-permissions-matrix" className="overflow-x-auto border border-border rounded-xl bg-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground font-mono uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Feature \\ Role</th>
                {roles.map((role) => (
                  <th key={role} className="px-4 py-3 font-medium text-center">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredFeatures.length === 0 ? (
                <tr>
                  <td colSpan={roles.length + 1} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No features in this category.
                  </td>
                </tr>
              ) : (
                filteredFeatures.map((feature) => {
                  const isGloballyEnabled = ENABLED_FEATURES.has(feature);
                  return (
                    <tr key={feature} className="hover:bg-secondary/10 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{feature}</div>
                        {!isGloballyEnabled && (
                          <div className="text-[10px] text-warning mt-1">Not in launch mode</div>
                        )}
                      </td>
                      {roles.map((role) => {
                        const enabled = isFeatureEnabledForRole(role, feature);
                        return (
                          <td key={`${role}-${feature}`} className="px-4 py-3 text-center">
                            <Switch
                              checked={enabled}
                              onCheckedChange={() => handleToggle(role, feature, enabled)}
                              disabled={!isGloballyEnabled && user.role !== "admin"} // admins can toggle even if globally disabled just in case
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
