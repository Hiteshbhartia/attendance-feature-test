import React from "react";
import { useLocation } from "@tanstack/react-router";
import { useRoleFeature } from "../hooks/useRoleFeature";
import ComingSoon from "./ComingSoon";

interface LaunchGuardProps {
  children: React.ReactNode;
  featureKey?: string;
}

/**
 * Wraps a component and renders it only if the current route (or specific featureKey) is enabled for the current role.
 * Otherwise, renders the ComingSoon component and blocks rendering (and thus data fetching) of the children.
 */
export function LaunchGuard({ children, featureKey }: LaunchGuardProps) {
  const location = useLocation();
  const isFeatureEnabled = useRoleFeature();
  
  // Use explicit featureKey if provided, otherwise use the current route path
  const isEnabled = isFeatureEnabled(featureKey || location.pathname);

  if (!isEnabled) {
    return <ComingSoon />;
  }

  return <>{children}</>;
}
