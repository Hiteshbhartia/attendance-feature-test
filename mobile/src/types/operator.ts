// src/types/operator.ts

/** Types for operator daily brief API */
export interface DailyBriefSummary {
  bestZone: string;
  weakZone: string;
  topPerformer: string;
  topBlocker: string;
  hotLeadRisk: string;
  priorities: string[];
  oneLineForLeadership: string;
}

export interface DailyBriefResponse {
  summary: DailyBriefSummary;
  raw: string;
  fallback?: boolean;
}
