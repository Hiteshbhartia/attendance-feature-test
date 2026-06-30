// src/hooks/useLaunchFeature.ts

import { LAUNCH_MODE, ENABLED_FEATURES, FEATURE_MAP } from "../config/launch-config";
import { useLocation } from "@tanstack/react-router";

/**
 * Hook to determine if a feature identified by its route path is enabled.
 * In launch mode only features listed in ENABLED_FEATURES are visible.
 * Outside launch mode (development) everything is enabled.
 */
export function useLaunchFeature(): (path: string) => boolean {
  const location = useLocation();
  return (path: string) => {
    if (!LAUNCH_MODE) return true;
    const featureKey = FEATURE_MAP[path] ?? "";
    if (!featureKey) return true; // routes without mapping are considered always visible
    return ENABLED_FEATURES.has(featureKey);
  };
}
