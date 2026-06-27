// Recognition + growth loop. Pure derivation from scores (no extra storage).
import { type Employee } from "@/types/hr";
import { getRoster } from "@/lib/roster";
import { computeScore, rankInSquad, tierOf } from "./score-engine";
import { kudosReceived } from "./kudos-store";
import {
  Award,
  Flame,
  Trophy,
  Heart,
  ShieldCheck,
  Star,
  Zap,
  Sparkles,
  Crown,
  Target,
  type LucideIcon,
} from "lucide-react";

export type AchievementLevel = "bronze" | "silver" | "gold" | "platinum";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  level: AchievementLevel;
  progress: number; // 0-100
  icon: LucideIcon;
  basis: "attendance" | "performance" | "consistency" | "kudos" | "rank" | "streak";
}

const D = 24 * 60 * 60 * 1000;

const LEVEL_RING: Record<AchievementLevel, string> = {
  bronze: "from-amber-700 to-amber-500",
  silver: "from-slate-400 to-slate-200",
  gold: "from-amber-400 to-yellow-300",
  platinum: "from-cyan-300 to-violet-300",
};

export function levelClasses(level: AchievementLevel) {
  return LEVEL_RING[level];
}

export function achievementsFor(emp: Employee): Achievement[] {
  const score = computeScore(emp);
  const rank = rankInSquad(emp);
  const kudos = kudosReceived(emp.id, Date.now() - 30 * D).length;

  const list: Achievement[] = [
    {
      id: "att-perfect",
      title: "Perfect Pulse",
      description: "Attendance ≥ 95 — show up like clockwork.",
      earned: emp.attendance >= 95,
      level: emp.attendance >= 99 ? "platinum" : "gold",
      progress: Math.min(100, Math.round((emp.attendance / 95) * 100)),
      icon: ShieldCheck,
      basis: "attendance",
    },
    {
      id: "att-reliable",
      title: "Always In",
      description: "Attendance ≥ 85 across the month.",
      earned: emp.attendance >= 85,
      level: "silver",
      progress: Math.min(100, Math.round((emp.attendance / 85) * 100)),
      icon: Target,
      basis: "attendance",
    },
    {
      id: "perf-apex",
      title: "Apex Player",
      description: "Performance score ≥ 85 — A-tier execution.",
      earned: emp.performance >= 85,
      level: emp.performance >= 92 ? "platinum" : "gold",
      progress: Math.min(100, Math.round((emp.performance / 85) * 100)),
      icon: Trophy,
      basis: "performance",
    },
    {
      id: "perf-rising",
      title: "Rising Force",
      description: "Performance ≥ 70 — closing the gap.",
      earned: emp.performance >= 70,
      level: "silver",
      progress: Math.min(100, Math.round((emp.performance / 70) * 100)),
      icon: Zap,
      basis: "performance",
    },
    {
      id: "consist-rock",
      title: "Steady Rock",
      description: "Consistency ≥ 85 — predictable excellence.",
      earned: emp.consistency >= 85,
      level: emp.consistency >= 95 ? "platinum" : "gold",
      progress: Math.min(100, Math.round((emp.consistency / 85) * 100)),
      icon: Star,
      basis: "consistency",
    },
    {
      id: "streak-fire",
      title: "On Fire",
      description: "14+ day streak. Don't break the chain.",
      earned: emp.streakDays >= 14,
      level: emp.streakDays >= 30 ? "platinum" : emp.streakDays >= 21 ? "gold" : "silver",
      progress: Math.min(100, Math.round((emp.streakDays / 14) * 100)),
      icon: Flame,
      basis: "streak",
    },
    {
      id: "kudos-loved",
      title: "Crowd Favorite",
      description: "3+ kudos in the last 30 days.",
      earned: kudos >= 3,
      level: kudos >= 6 ? "gold" : "silver",
      progress: Math.min(100, Math.round((kudos / 3) * 100)),
      icon: Heart,
      basis: "kudos",
    },
    {
      id: "rank-top",
      title: "Squad Captain",
      description: "Top 1 in your squad ranking.",
      earned: rank.rank === 1,
      level: "platinum",
      progress:
        rank.rank === 1
          ? 100
          : Math.max(0, Math.round(((rank.total - rank.rank) / Math.max(1, rank.total - 1)) * 100)),
      icon: Crown,
      basis: "rank",
    },
    {
      id: "tier-a",
      title: "A-Tier",
      description: "Total score lands in A band.",
      earned: tierOf(emp) === "A",
      level: "gold",
      progress: Math.min(100, Math.round((score.total / 85) * 100)),
      icon: Award,
      basis: "performance",
    },
    {
      id: "all-rounder",
      title: "All-Rounder",
      description: "Attendance, performance, and consistency all ≥ 80.",
      earned: emp.attendance >= 80 && emp.performance >= 80 && emp.consistency >= 80,
      level: "platinum",
      progress: Math.round(
        (Math.min(emp.attendance, 100) +
          Math.min(emp.performance, 100) +
          Math.min(emp.consistency, 100)) /
          3,
      ),
      icon: Sparkles,
      basis: "performance",
    },
  ];

  return list;
}

export function earnedCount(emp: Employee) {
  return achievementsFor(emp).filter((a) => a.earned).length;
}

export function topGrowthAreas(emp: Employee): { label: string; value: number; target: number }[] {
  const areas = [
    { label: "Attendance", value: emp.attendance, target: 95 },
    { label: "Performance", value: emp.performance, target: 85 },
    { label: "Consistency", value: emp.consistency, target: 85 },
  ];
  return areas
    .map((a) => ({ ...a, gap: a.target - a.value }))
    .sort((a, b) => b.gap - a.gap)
    .map(({ gap, ...rest }) => {
      void gap;
      return rest;
    });
}

export function leaderboardByEarned() {
  return [...getRoster()]
    .map((e) => ({ emp: e, earned: earnedCount(e), score: computeScore(e).total }))
    .sort((a, b) => b.earned - a.earned || b.score - a.score);
}
