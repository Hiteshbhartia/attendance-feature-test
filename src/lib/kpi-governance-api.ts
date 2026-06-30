import { api } from "@/lib/api-client";

import type {
  KpiDefinition,
  KpiTarget,
  KpiListResponse,
  TargetListResponse,
  KpiHistoryEntry,
  KpiTargetHistoryEntry,
  KpiScopeType,
} from "@/types/kpi";

export type {
  KpiDefinition,
  KpiTarget,
  KpiListResponse,
  TargetListResponse,
  KpiHistoryEntry,
  KpiTargetHistoryEntry,
  KpiScopeType,
};

/** Runtime guard for KPI definitions array */
export function isKpiDefinitionArray(value: unknown): value is import("@/types/kpi").KpiDefinition[] {
  return Array.isArray(value);
}
/** Runtime guard for KPI targets array */
export function isKpiTargetArray(value: unknown): value is import("@/types/kpi").KpiTarget[] {
  return Array.isArray(value);
}

export async function fetchKpiDefinitions(filters?: {
  active?: boolean;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<KpiListResponse> {
  const query = new URLSearchParams();
  if (filters?.active !== undefined) {
    query.set("active", String(filters.active));
  }
  if (filters?.category) {
    query.set("category", filters.category);
  }
  if (filters?.search) {
    query.set("search", filters.search);
  }
  if (filters?.page) {
    query.set("page", String(filters.page));
  }
  if (filters?.limit) {
    query.set("limit", String(filters.limit));
  }

  const queryString = query.toString();
  return api.get<KpiListResponse>(`/kpis${queryString ? `?${queryString}` : ""}`);
}

export async function createKpiDefinition(
  data: Partial<KpiDefinition>,
): Promise<{ ok: boolean; definition: KpiDefinition }> {
  return api.post<{ ok: boolean; definition: KpiDefinition }>("/kpis", data);
}

export async function updateKpiDefinition(
  id: string,
  data: Partial<KpiDefinition>,
): Promise<{ ok: boolean; definition: KpiDefinition }> {
  return api.patch<{ ok: boolean; definition: KpiDefinition }>(`/kpis/${id}`, data);
}

export async function archiveKpiDefinition(
  id: string,
): Promise<{ ok: boolean; definition: KpiDefinition }> {
  return api.post<{ ok: boolean; definition: KpiDefinition }>(`/kpis/${id}/archive`, {});
}

export async function fetchKpiTargets(filters?: {
  kpiId?: string;
  scopeType?: string;
  scopeId?: string;
  page?: number;
  limit?: number;
}): Promise<TargetListResponse> {
  const query = new URLSearchParams();
  if (filters?.kpiId) {
    query.set("kpiId", filters.kpiId);
  }
  if (filters?.scopeType) {
    query.set("scopeType", filters.scopeType);
  }
  if (filters?.scopeId) {
    query.set("scopeId", filters.scopeId);
  }
  if (filters?.page) {
    query.set("page", String(filters.page));
  }
  if (filters?.limit) {
    query.set("limit", String(filters.limit));
  }

  const queryString = query.toString();
  return api.get<TargetListResponse>(`/kpi-targets${queryString ? `?${queryString}` : ""}`);
}

export async function createKpiTarget(
  data: Partial<KpiTarget>,
): Promise<{ ok: boolean; target: KpiTarget }> {
  return api.post<{ ok: boolean; target: KpiTarget }>("/kpi-targets", data);
}

export async function updateKpiTarget(
  id: string,
  data: Partial<KpiTarget>,
): Promise<{ ok: boolean; target: KpiTarget }> {
  return api.patch<{ ok: boolean; target: KpiTarget }>(`/kpi-targets/${id}`, data);
}
