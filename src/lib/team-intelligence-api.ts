/**
 * Client-side hooks and types for the Team Intelligence API layer.
 * GET /api/operator/team-intelligence
 * GET /api/operator/member/:id/intelligence
 *
 * Follows the existing api-client pattern: null-safe, typed, stable arrays.
 */

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";


import type {
  MemberMetrics,
  TeamHealth,
  TeamComparison,
  TeamIntelligenceData,
  MemberIntelligence
} from '@/types/team';

// ─── Hooks ────────────────────────────────────────────────────────────────────

const EMPTY_HEALTH: TeamHealth = {
  total: 0,
  present: 0,
  late: 0,
  absent: 0,
  leaveRisk: 0,
  burnoutHigh: 0,
  avgEngagement: 0,
  avgCompletion: 0,
  avgPresence: 0,
};

const EMPTY_DATA: TeamIntelligenceData = {
  ok: false,
  generatedAt: 0,
  period: { from: "", daysBack: 30 },
  health: EMPTY_HEALTH,
  members: [],
  topPerformers: [],
  interventionNeeded: [],
  teamComparison: [],
  orgInsights: [],
};

export function useTeamIntelligence() {
  const [data, setData] = useState<TeamIntelligenceData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<TeamIntelligenceData>("/operator/team-intelligence");
      setData({
        ...EMPTY_DATA,
        ...res,
        health: { ...EMPTY_HEALTH, ...(res.health ?? {}) },
        members: Array.isArray(res.members) ? res.members : [],
        topPerformers: Array.isArray(res.topPerformers) ? res.topPerformers : [],
        interventionNeeded: Array.isArray(res.interventionNeeded) ? res.interventionNeeded : [],
        teamComparison: Array.isArray(res.teamComparison) ? res.teamComparison : [],
        orgInsights: Array.isArray(res.orgInsights) ? res.orgInsights : [],
        kpiDefinitions: Array.isArray(res.kpiDefinitions) ? res.kpiDefinitions : [],
        kpiTargets: Array.isArray(res.kpiTargets) ? res.kpiTargets : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team intelligence");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { data, loading, error, refresh: fetch };
}

export function useMemberIntelligence(employeeId: string | null) {
  const [data, setData] = useState<MemberIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<MemberIntelligence>(`/operator/member/${id}/intelligence`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load member intelligence");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (employeeId) void fetch(employeeId);
    else setData(null);
  }, [employeeId, fetch]);

  return { data, loading, error };
}
