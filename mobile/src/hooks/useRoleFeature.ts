import { useQuery } from "@tanstack/react-query";
import { LAUNCH_MODE, ENABLED_FEATURES, FEATURE_MAP, ROLE_MATRIX } from "../config/launch-config";
import { useAuth } from "@/contexts/AuthContext";
import { getPermissions } from "@/api/permissions";

/**
 * Returns a function that tells you whether a given route path is enabled
 * for the current user's role. Handles both global LAUNCH_MODE gates and
 * per-role permission overrides stored in the database.
 */
export function useRoleFeature(): (path: string) => boolean {
  const { user } = useAuth();
  const role = user?.role || "employee";

  // Fetch DB permission overrides (only when logged in)
  const { data: dbPermissions } = useQuery({
    queryKey: ["permissions", role],
    queryFn: () => getPermissions(role),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return (path: string): boolean => {
    // Resolve dynamic path segments back to route definition for feature mapping
    let resolvedPath = path;
    if (path.startsWith("/employee-stats/")) {
      resolvedPath = "/employee-stats/$id";
    }
    if (path.startsWith("/employee/")) {
      resolvedPath = "/employee/$empId";
    }

    // Resolve the feature key for this path
    const featureKey = FEATURE_MAP[resolvedPath] ?? resolvedPath;

    // ── LAUNCH_MODE global gate ──────────────────────────────────────────
    // If we are in launch mode and the route has a known mapping,
    // allow it ONLY if its feature key is in ENABLED_FEATURES.
    if (LAUNCH_MODE) {
      // Home (/) is always allowed
      if (path === "/") return true;

      // If the path is mapped to a feature key, check the whitelist
      if (FEATURE_MAP[resolvedPath] !== undefined) {
        if (!ENABLED_FEATURES.has(featureKey)) return false;
      } else {
        // Unmapped routes are hidden in launch mode
        return false;
      }
    }

    // ── DB permission overrides ──────────────────────────────────────────
    if (dbPermissions && dbPermissions.length > 0) {
      const perm = dbPermissions.find((p) => p.feature === featureKey);
      if (perm) return perm.enabled;
    }

    // ── Role matrix fallback ─────────────────────────────────────────────
    const allowedFeatures = ROLE_MATRIX[role] ?? [];
    if (allowedFeatures.includes(featureKey)) return true;

    // If the feature key is explicitly listed somewhere in the matrix (for
    // any role), deny it for this role since it's not in their list.
    const allMapped = Object.values(FEATURE_MAP);
    if (allMapped.includes(featureKey)) return false;

    // Unknown paths default to visible
    return true;
  };
}
