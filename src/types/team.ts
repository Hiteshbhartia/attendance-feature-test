// src/types/team.ts

/** Types for Team Intelligence panel */
export interface TeamMetric {
  // Placeholder for generic metric representation if needed
  name: string;
  value: number;
  unit?: string;
}

export interface TeamInsight {
  label: string;
  value: string;
}

export interface ZoneStats {
  zone: string;
  calls: number;
  visitsScheduled: number;
  visitsCompleted: number;
  hotLeads: number;
  bookings: number;
  blockers: number;
  contributors: number;
}

/** Member specific metrics */
export interface MemberMetrics {
  employeeId: string;
  name: string;
  role: string;
  team: string;
  tasks: {
    total: number;
    done: number;
    overdue: number;
    completionRate: number;
  };
  presence: number;
  burnoutRisk: "none" | "low" | "medium" | "high";
  attendance: {
    clockInCount: number;
    lateArrivals: number;
    streakDays: number;
  };
  kudos: { recent: number };
  insights: string[];
  riskFlags?: string[];
}

export interface TeamHealth {
  total: number;
  present: number;
  late: number;
  absent: number;
  leaveRisk: number;
  burnoutHigh: number;
  avgEngagement: number;
  avgCompletion: number;
  avgPresence: number;
}

export interface TeamComparison {
  team: string;
  count: number;
  avgPerformance: number;
  avgPresence: number;
  avgCompletion: number;
  burnoutCount: number;
}

/** Aggregated response from the Team Intelligence API */
export interface TeamIntelligenceData {
  ok: boolean;
  generatedAt: number;
  period: { from: string; daysBack: number };
  health: TeamHealth;
  members: MemberMetrics[];
  topPerformers: Array<{
    employeeId: string;
    name: string;
    role: string;
    performance: number;
    completionRate: number;
    engagementScore: number;
  }>;
  interventionNeeded: Array<{
    employeeId: string;
    name: string;
    burnoutRisk: string;
    needsIntervention: boolean;
    flags: string[];
    insights: string[];
  }>;
  teamComparison: TeamComparison[];
  orgInsights: string[];
  kpiDefinitions?: import("./kpi").KPI[]; // imported type
  kpiTargets?: import("./kpi").KPITarget[];
}

export interface MemberIntelligence {
  ok: boolean;
  generatedAt: number;
  period: { from: string; daysBack: number };
  metrics: MemberMetrics;
  trends: {
    weeklyPresence: Array<{ week: string; count: number }>;
    tasksByStatus: { todo: number; doing: number; done: number; blocked: number };
    kudoHistory: Array<{ ts: number; tag: string }>;
  };
  kpiDefinitions?: import("./kpi").KPI[];
  kpiTargets?: import("./kpi").KPITarget[];
}
