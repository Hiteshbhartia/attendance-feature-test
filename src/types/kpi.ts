// src/types/kpi.ts

/** Core KPI definition used across the application */
export interface KpiDefinition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  unit: string;
  frequency: string;
  aggregationType: string;
  visibilityScope: string;
  ownerRole: string;
  targetType: string;
  active: boolean;
  archivedAt?: number;
  deprecated: boolean;
  replacedBy?: string;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  history?: KpiHistoryEntry[];
}

/** Single entry in KPI version history */
export interface KpiHistoryEntry {
  version: number;
  updatedBy: string;
  updatedAt: number;
  changes: Record<string, { from: unknown; to: unknown }>;
}

/** KPI target configuration */
export type KpiScopeType = "org" | "zone" | "team" | "individual";

export interface KpiTarget {
  id: string;
  kpiId: string;
  scopeType: KpiScopeType;
  scopeId?: string;
  targetValue: number;
  effectiveFrom: string;
  effectiveTo: string;
  ownerId?: string;
  notes?: string;
  version: number;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  history?: KpiTargetHistoryEntry[];
}

/** History entry for a KPI target */
export interface KpiTargetHistoryEntry {
  version: number;
  targetValue: number;
  effectiveFrom: string;
  effectiveTo: string;
  updatedBy: string;
  updatedAt: number;
  notes?: string;
}

/** Response shape for KPI list endpoint */
export interface KpiListResponse {
  ok: boolean;
  definitions: KpiDefinition[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

/** Response shape for KPI targets list endpoint */
export interface TargetListResponse {
  ok: boolean;
  targets: KpiTarget[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

/** Governance response wrapper used by UI */
export interface GovernanceResponse {
  ok: boolean;
  definitions: KpiDefinition[];
  targets: KpiTarget[];
}

/** Trend data point for KPI charts */
export interface KPITrend {
  ts: number; // timestamp
  value: number;
}

/** Single chart data point */
export interface KPIChartPoint {
  label: string;
  value: number;
}

/** Alias for basic KPI metric */
export interface KPI {
  id: string;
  name: string;
  slug: string;
  description?: string;
  frequency: string;
  category?: string;
  ownerTier?: string;
  targetType: "min" | "max";
  unit: string;
}

/** Alias for KPI target used in UI */
export interface KPITarget {
  id: string;
  kpiId: string;
  scopeType: string;
  scopeId?: string;
  targetValue: number;
}

