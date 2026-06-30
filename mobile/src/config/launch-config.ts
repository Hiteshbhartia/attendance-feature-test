// src/config/launch-config.ts
// Central launch-mode configuration.
// Controls which routes/features are enabled in the production launch build.
// ⚠️  This file governs UI visibility only.
//     Runtime role permissions live in the database (permissions collection).

// ─── Launch flag ────────────────────────────────────────────────────────────
/**
 * When true the app is in "launch mode": only ENABLED_FEATURES are shown
 * and all other routes are hidden from navigation, sidebar and the command
 * palette. Non-admin roles never see the Permissions module regardless.
 */
export const LAUNCH_MODE = true;

// ─── Approved launch routes ──────────────────────────────────────────────────
/**
 * The full set of URL paths that are enabled in the launch build.
 * Used by LaunchGuard and the sidebar to filter navigation.
 */
export const LAUNCH_ROUTES = new Set<string>([
  "/",                    // Home
  "/attendance",          // Selfie Attendance
  "/pulse",               // Daily Pulse
  "/fly",                 // Fly Board
  "/tasks",               // Tasks
  "/console",             // Operator Console
  "/roster",              // Live Roster
  "/admin/kpis",          // KPI Governance
  "/kudos",               // Kudos
  "/one-on-ones",         // 1:1 Notes
  "/admin/workforce",     // Workforce
  "/admin/permissions",   // Permissions (Admin only — enforced in route guard)
  "/org-goals",           // Org Goals
  "/live-attendance",     // Live Attendance
  "/task-throughput",     // Task Throughput
  "/employee-stats/$id",  // Employee Stats
  "/inbox",               // Inbox
  "/admin/zones",         // Manage Zones
  "/calendar",            // Calendar
  "/command",             // Coach AI
  "/employee/$empId",     // Employee Profile
]);

// ─── Feature key whitelist ───────────────────────────────────────────────────
/**
 * The set of feature keys that are enabled in the launch build.
 * FEATURE_MAP maps route paths → feature keys; ENABLED_FEATURES is the
 * allowlist checked by useRoleFeature and useLaunchFeature.
 */
export const ENABLED_FEATURES = new Set<string>([
  "home",
  "selfieAttendance",
  "dailyPulse",
  "flyBoard",
  "tasks",
  "liveRoster",
  "operatorConsole",
  "kpiGovernance",
  "kudos",
  "oneOnOnes",
  "workforce",
  "adminPermissions",   // visible only to admins — enforced in route/sidebar
  "orgGoals",
  "liveAttendance",
  "taskThroughput",
  "inbox",
  "manageZones",
  "calendar",
  "coach",
  "employeeProfile",
]);

// ─── Route → feature key map ─────────────────────────────────────────────────
/**
 * Maps URL paths to their logical feature keys.
 * Used by useRoleFeature and useLaunchFeature to resolve which feature
 * a given route corresponds to.
 */
export const FEATURE_MAP: Record<string, string> = {
  "/":                    "home",
  "/attendance":          "selfieAttendance",
  "/pulse":               "dailyPulse",
  "/fly":                 "flyBoard",
  "/tasks":               "tasks",
  "/console":             "operatorConsole",
  "/roster":              "liveRoster",
  "/admin/kpis":          "kpiGovernance",
  "/kudos":               "kudos",
  "/one-on-ones":         "oneOnOnes",
  "/admin/workforce":     "workforce",
  "/admin/permissions":   "adminPermissions",
  "/org-goals":           "orgGoals",
  "/live-attendance":     "liveAttendance",
  "/task-throughput":     "taskThroughput",
  "/employee-stats/$id":  "home",
  "/inbox":               "inbox",
  "/admin/zones":         "manageZones",
  "/calendar":            "calendar",
  "/command":             "coach",
  "/employee/$empId":     "employeeProfile",
};

// ─── Role permission matrix ───────────────────────────────────────────────────
/**
 * Default set of feature keys each role can access.
 * This is used as a fallback when no DB permission override exists.
 * adminPermissions is intentionally absent from hr/manager/employee rows.
 */
export const ROLE_MATRIX: Record<string, string[]> = {
  admin: [
    "home",
    "selfieAttendance",
    "dailyPulse",
    "flyBoard",
    "tasks",
    "operatorConsole",
    "liveRoster",
    "kpiGovernance",
    "kudos",
    "oneOnOnes",
    "workforce",
    "adminPermissions",   // Admin-only
    "orgGoals",
    "liveAttendance",
    "taskThroughput",
    "inbox",
    "manageZones",
    "calendar",
    "coach",
    "employeeProfile",
  ],
  hr: [
    "home",
    "selfieAttendance",
    "dailyPulse",
    "flyBoard",
    "tasks",
    "operatorConsole",
    "liveRoster",
    "kpiGovernance",
    "kudos",
    "oneOnOnes",
    "workforce",
    "orgGoals",
    "liveAttendance",
    "taskThroughput",
    "inbox",
    "calendar",
    "employeeProfile",
  ],
  manager: [
    "home",
    "selfieAttendance",
    "dailyPulse",
    "flyBoard",
    "tasks",
    "operatorConsole",
    "liveRoster",
    "kudos",
    "oneOnOnes",
    "liveAttendance",
    "inbox",
    "calendar",
    "employeeProfile",
  ],
  employee: [
    "home",
    "selfieAttendance",
    "dailyPulse",
    "tasks",
    "kudos",
    "oneOnOnes",
    "inbox",
    "calendar",
    "employeeProfile",
  ],
};
