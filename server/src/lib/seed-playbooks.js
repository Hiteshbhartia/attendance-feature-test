/**
 * seed-playbooks.js — Seed all role playbooks into MongoDB.
 *
 * Playbook IDs use the role-slug format:
 *   actor.role.toLowerCase().replace(/\s+/g, "_")
 *
 * This matches the resolution logic in:
 *   - src/routes/console.tsx  (ConsolePage: playbookKey)
 *   - src/lib/console-store.ts (shieldNow / currentSprint / etc.)
 *   - src/components/AppShell.tsx (hasPlaybook)
 */

import { Playbook } from "../models/index.js";

const t = (h, m = 0) => h * 60 + m;

// ─── COMMUNICATION SHIELD (Floor Lead / Nithya) ──────────────────────────────
const COMMUNICATION_SHIELD = {
  id: "communication_shield",
  title: "Communication Shield",
  subtitle: "In-Office Command · Precision Communication",
  oneLiner:
    "You run the in-office engine and control Gharpayy's entire communication rhythm. Every hour counts, every message lands.",
  interdependence:
    "If this role fails → office discipline collapses → Sneha has no floor data → Jiya's trainees enter chaos.",
  collapseRule:
    "If in-office call volume < 50% of daily target by 1:00 PM, OR any employee unreachable for 2+ hours → alert the Performance Enforcer at the 1:00 PM window.",
  shieldBlocks: [
    { startMin: t(10, 40), endMin: t(13, 0), label: "Sprint Block · No group msgs" },
    { startMin: t(14, 0), endMin: t(17, 0), label: "Sprint Block · No group msgs" },
  ],
  kpis: [
    { id: "ontime", label: "On-time at desk by 10:30", target: 100, unit: "%", kind: "percent", why: "A late start is a lost morning sprint." },
    { id: "conn", label: "Avg connections / person", target: 70, kind: "count", why: "Below 70, the funnel collapses by EOD." },
    { id: "ghost", label: "Ghost leads cleared", target: 1, kind: "boolean", why: "Zero leads without a next-step task." },
    { id: "stuck", label: "Stuck WhatsApp chats >24h", target: 0, kind: "count", why: "Silence kills trust. Move every chat." },
    { id: "revived", label: "Revived leads (7-day sweep)", target: 20, kind: "count", why: "Yesterday's silence is today's revenue." },
    { id: "audited", label: "Lead journeys audited", target: 30, kind: "count", why: "Movement, not chatting. Tour-bound or out." },
    { id: "corrections", label: "Real-time corrections", target: 5, kind: "count", why: "Fix the pitch on the call, not at debrief." },
    { id: "windows", label: "Comm windows sent on time", target: 4, kind: "count", why: "4 windows. Not 5. Not 3. Exactly 4." },
    { id: "scored", label: "Every employee scored A/B/C", target: 1, kind: "boolean", why: "Public scoreboard or no scoreboard." },
    { id: "c_player_1on1", label: "C-player 1:1s done by 7 PM", target: 1, kind: "boolean", why: "C-players don't go home without a plan." },
  ],
  sprints: [
    {
      id: "n_s1", index: 1, name: "Floor Ignition + CRM Audit",
      startMin: t(10, 30), endMin: t(12, 0),
      objective: "Start sharp. Every target spoken. CRM clean before Sprint 2.",
      actions: [
        { time: "10:25", do: "Setup attendance, perf tracker, CRM open", output: "Systems ready" },
        { time: "10:30", do: "Stand-up — every person states their target out loud", output: "Targets spoken" },
        { time: "10:40", do: "Lock attendance. Shield Mode begins", output: "Group msg sent at 10:40" },
        { time: "10:45–11:30", do: "CRM Audit Round 1 — assign next-step task to every ghost lead", output: "Zero ghost leads" },
        { time: "11:30–12:00", do: "Floor monitoring — catch 3 early blockers", output: "3 blockers resolved" },
      ],
      metric: "100% CRM task alignment. 70+ acknowledged. Ghost leads cleared.",
    },
    {
      id: "n_s2", index: 2, name: "WhatsApp + 7-Day Lead Sweep",
      startMin: t(12, 0), endMin: t(13, 0),
      objective: "No chat stuck >7 days. 20 leads revived.",
      actions: [
        { time: "12:00–12:30", do: "Sweep WhatsApp — every chat older than 24h gets a move", output: "Backlog cleared" },
        { time: "12:30–1:00", do: "7-day sweep — revive 20 leads with new pitch", output: "20 revived" },
      ],
      metric: "Zero chats stuck >7 days. 20 leads revived.",
    },
    {
      id: "n_s3", index: 3, name: "Lead Journey Audit + Real-Time Corrections",
      startMin: t(14, 30), endMin: t(16, 0),
      objective: "Leads must be moving toward a tour, not in circles.",
      shielded: true,
      actions: [
        { time: "2:30–3:30", do: "Audit 30 lead journeys — flag the ones going in circles", output: "30 journeys verified" },
        { time: "3:30–4:00", do: "5 real-time corrections — intervene on the live call", output: "5 corrections done" },
      ],
      metric: "30 journeys verified. 5 real-time corrections.",
    },
    {
      id: "n_s4", index: 4, name: "70-Connection Enforcement",
      startMin: t(16, 0), endMin: t(17, 0),
      objective: "No one ends below 70. Lagging employees get a protected sprint.",
      actions: [
        { time: "4:00–4:30", do: "Audit who's below 50 — give them a 30-min uninterrupted block", output: "Lagging in protected sprint" },
        { time: "4:30–5:00", do: "Push the floor — public count visible", output: "Count visible to all" },
      ],
      metric: "Every person on track for 70+ by 7 PM.",
    },
    {
      id: "n_s5", index: 5, name: "Final Push + Scorecards",
      startMin: t(17, 20), endMin: t(19, 30),
      objective: "Public scoreboard. C-player 1:1 before 7 PM.",
      actions: [
        { time: "5:20–6:30", do: "Post scoreboard. C-player 1:1 mandatory", output: "Scoreboard posted, 1:1 done" },
        { time: "6:30–7:30", do: "Action plans signed. EOD prep", output: "Plans signed" },
      ],
      metric: "All scored. All C-players have a written plan for tomorrow.",
    },
  ],
  commWindows: [
    {
      id: "n_w1", label: "Morning Ignition", atMin: t(10, 30), channel: "WhatsApp Group",
      template: "🌅 Good morning, Gharpayy!\nToday's targets:\n📞 Connections per person: 70+\n🏠 Tours to support: 10\n💬 WhatsApp chats actioned: All of them\n⏰ Everyone at desk. Targets spoken. Let's start.\nNext update: 1:00 PM. 💪",
    },
    {
      id: "n_w2", label: "Mid-Day Pulse", atMin: t(13, 0), channel: "WhatsApp Group",
      template: "📊 1 PM — Numbers before break:\nConnections avg: {{avg}}\nTours booked: {{tours}}\nChats stuck >24h: {{stuck}} — must be zero by 5 PM\nOn track: {{on_track}}\nNeeds push: {{needs_push}}\nBreak: 1:15–2:00. Back at 2:00 sharp. 🍽️",
    },
    {
      id: "n_w3", label: "Pre-Snack Push", atMin: t(17, 0), channel: "WhatsApp Group",
      template: "🔥 5 PM check-in:\nConnections avg: {{avg}} (need 70+)\nTours today: {{tours}}/10\nRevived leads: {{revived}}/20\nStrong finish: {{strong}}\nFinal sprint needed: {{final}}\nSnack: 5:00–5:20. 5:20 — final push. No drift. 💪",
    },
    {
      id: "n_w4", label: "EOD Report", atMin: t(19, 30), channel: "WhatsApp Group",
      template: "🌙 EOD — {{date}}\nConnections avg: {{avg}}/70\nTours done: {{tours}}/10\nStuck chats: {{stuck}}\nRevived: {{revived}}/20\nA: {{a}} | B: {{b}} | C: {{c}}\nHard decision today: {{hard}}",
    },
  ],
  eodFields: [
    { id: "avg_conn", label: "Avg connections / person", kind: "number" },
    { id: "tours", label: "Tours from floor", kind: "number" },
    { id: "stuck", label: "Stuck chats remaining", kind: "number" },
    { id: "revived", label: "Leads revived", kind: "number" },
    { id: "a", label: "A players (names)", kind: "list" },
    { id: "b", label: "B players (names)", kind: "list" },
    { id: "c", label: "C players (names)", kind: "list" },
    { id: "ghost_clean", label: "CRM clean — zero ghost leads?", kind: "yesno" },
    { id: "windows_on_time", label: "All 4 windows sent on time?", kind: "yesno" },
    { id: "hard", label: "The hard decision today", kind: "text", placeholder: "e.g., Formal warning to X for second late entry." },
    { id: "flag", label: "Flag for leadership", kind: "text" },
  ],
};

// ─── PERFORMANCE ENFORCER (TCM Lead / Sneha) ──────────────────────────────────
const PERFORMANCE_ENFORCER = {
  id: "performance_enforcer",
  title: "Performance Enforcer",
  subtitle: "Tours + Closings Command · The 10:16:60 Standard",
  oneLiner:
    "Ensure the revenue engine never stops. 10 tours/day. 60% show-up. 2 closings/TCM after 6 tours.",
  interdependence:
    "If this role fails → tours don't happen → closings don't happen → Gharpayy makes no money.",
  collapseRule:
    "If tours < 10 by 5:00 PM, OR show-up % < 60 weekly → alert the Floor Lead and leadership at the 5:00 PM window.",
  shieldBlocks: [],
  kpis: [
    { id: "booked", label: "Tours booked", target: 16, kind: "count", why: "16 to guarantee 10 done at 60% show-up." },
    { id: "done", label: "Tours completed", target: 10, kind: "count", why: "10 is the floor. Below 10 = no revenue day." },
    { id: "showup", label: "Show-up % this week", target: 60, unit: "%", kind: "percent", why: "Below 60% = pitch or confirmation broken." },
    { id: "closings", label: "TCM closings (after 6 tours)", target: 2, kind: "count", why: "6 tours and no close = the ask was missed." },
    { id: "noshows", label: "No-shows analyzed", target: 100, unit: "%", kind: "percent", why: "Every no-show has a named reason. No exceptions." },
    { id: "pitch_fix", label: "Pitch corrections sent", target: 5, kind: "count", why: "Specific quote → specific fix → next call." },
    { id: "tomorrow", label: "Tomorrow's morning tours confirmed", target: 100, unit: "%", kind: "percent", why: "Confirmed today, or it's already broken." },
    { id: "ooo", label: "OOO team connected", target: 100, unit: "%", kind: "percent", why: "Silence in the morning = drift all day." },
    { id: "calls_listened", label: "Live calls listened-in", target: 8, kind: "count", why: "Coach in the moment, not at debrief." },
    { id: "red_zone_named", label: "Red-zone names published", target: 1, kind: "boolean", why: "If the floor doesn't see it, it isn't real." },
    { id: "tcm_six_rule", label: "TCMs hitting 6-tour rule", target: 100, unit: "%", kind: "percent", why: "Below 6 = the ask was never made." },
    { id: "evening_ranking", label: "Evening ranking posted", target: 1, kind: "boolean", why: "Public leaderboard at 6 PM. No exceptions." },
  ],
  sprints: [
    {
      id: "s_s1", index: 1, name: "Show-Up Drill + OOO Connect",
      startMin: t(10, 30), endMin: t(12, 0),
      objective: "Start the day knowing where yesterday broke and whether today can deliver 10 tours.",
      actions: [
        { time: "10:25", do: "Open Callyzer, Superfone, OOO group", output: "Systems live" },
        { time: "10:30–10:45", do: "OOO connect — 2-min check per person", output: "Everyone confirmed" },
        { time: "10:45–11:30", do: "Audit yesterday's show-up data — name root cause", output: "No-show analysis done" },
        { time: "11:30–12:00", do: "Correction calls to Flow Ops below 60%", output: "Specific fixes given" },
      ],
      metric: "60%+ show-up enforced. Zero un-analyzed no-shows. 100% OOO connected.",
    },
    {
      id: "s_s2", index: 2, name: "TCM Closing Audit",
      startMin: t(12, 0), endMin: t(13, 15),
      objective: "Did 6-tour-to-2-closing rule hit? If not, find the exact missed ask.",
      actions: [
        { time: "12:00–12:30", do: "Pull call logs — verify 6 tours per TCM + ask made", output: "Logs reviewed" },
        { time: "12:30–1:15", do: "Listen to recordings of misses — name the moment", output: "Gap documented w/ timestamp" },
      ],
      metric: "2 closings tracked per TCM. Every miss has a named reason.",
    },
    {
      id: "s_s3", index: 3, name: "Performance Correction + Floor Lead Sync",
      startMin: t(14, 30), endMin: t(16, 0),
      objective: "Intervene before the day runs out.",
      actions: [
        { time: "2:30–3:00", do: "Sync with Floor Lead — leads enough? comms blocking?", output: "Joint action agreed" },
        { time: "3:00–4:00", do: "Live correction — listen + intervene on 5 Flow Ops", output: "5 interventions done" },
      ],
      metric: "5 interventions. Floor Lead synced.",
    },
    {
      id: "s_s4", index: 4, name: "Tomorrow's Tour Guarantee",
      startMin: t(16, 0), endMin: t(17, 0),
      objective: "Every morning tour reconfirmed today.",
      actions: [
        { time: "4:00–4:45", do: "Call/WhatsApp every 10am-1pm tomorrow lead", output: "100% confirmed" },
        { time: "4:45–5:00", do: "Verify 16 bookings/Flow Op for tomorrow", output: "Gaps filled now" },
      ],
      metric: "Tomorrow's morning tours: 100% confirmed.",
    },
    {
      id: "s_s5", index: 5, name: "Evening OOO + Final Numbers",
      startMin: t(17, 20), endMin: t(19, 30),
      objective: "Public ranking. Final count visible to all.",
      actions: [
        { time: "5:20–6:00", do: "Pulse check — red zone updated", output: "Red zone shared" },
        { time: "6:00–7:00", do: "Evening OOO meeting — public ranking", output: "Numbers visible" },
        { time: "7:00–7:30", do: "Performance gap report → EOD", output: "Numbers ready" },
      ],
      metric: "Final ranking shared. Gap report ready.",
    },
  ],
  commWindows: [
    {
      id: "s_w1", label: "Morning OOO Connect (1:1)", atMin: t(10, 30), channel: "WhatsApp 1:1",
      template: "Hey {{name}} 👋 Quick 2-min check.\nWhat's your tour target today? Leads assigned? Any blockers? Reply now.",
    },
    {
      id: "s_w2", label: "Morning Group Start", atMin: t(10, 45), channel: "WhatsApp Group",
      template: "✅ Morning team! Everyone connected.\n🏠 Tours to book: 16 (to guarantee 10 done)\n📍 Show-ups yesterday: {{yest_showup}}\n💰 Closings expected: 2 per TCM (after 6 tours)\nThe number that matters: 10. Let's go. 🔑",
    },
    {
      id: "s_w3", label: "Specific Feedback (1:1)", atMin: t(15, 0), channel: "WhatsApp 1:1",
      template: "Hey {{name}}, reviewed your {{time}} call.\nWhen the customer said \"{{quote}}\", you responded with \"{{response}}\" — that's where they went cold.\nNext time say: \"{{better}}\".\nTry this in your next 3 calls. Tell me how it goes.",
    },
    {
      id: "s_w4", label: "Evening Group Update", atMin: t(18, 0), channel: "WhatsApp Group",
      template: "🌇 Evening update:\nTours completed: {{done}}/10\nShow-up this week: {{showup}}%\n🏆 Top performer: {{top}}\n⚠️ Red zone: {{red}}\nTomorrow's morning tours: {{tomorrow}} confirmed\nOne fix for tomorrow: {{fix}}",
    },
  ],
  eodFields: [
    { id: "ooo_connected", label: "OOO connected (X/total)", kind: "text" },
    { id: "booked", label: "Tours booked today", kind: "number" },
    { id: "done", label: "Tours completed", kind: "number" },
    { id: "showup", label: "Show-up % this week", kind: "number" },
    { id: "closings", label: "TCM closings today", kind: "number" },
    { id: "six_rule", label: "6-tour rule met?", kind: "yesno" },
    { id: "no_shows_root", label: "No-show root causes", kind: "list" },
    { id: "fixes_sent", label: "Pitch corrections sent", kind: "number" },
    { id: "tomorrow_confirmed", label: "Tomorrow morning tours confirmed (X/X)", kind: "text" },
    { id: "hard", label: "The hard decision today", kind: "text", placeholder: "e.g., Final warning — 40% show-up 3 days." },
    { id: "flag", label: "Flag for leadership", kind: "text" },
  ],
};

// ─── OPERATOR DAY (general Operator role) ────────────────────────────────────
const OPERATOR_DAY = {
  id: "operator",
  title: "Operator Day",
  subtitle: "Field Execution · Lead-to-Tour Pipeline",
  oneLiner:
    "Execute the day's lead pipeline with precision. Hit 70 connections, move every chat, and close every tour you can.",
  interdependence:
    "Your activity directly fills the tour calendar. If you slow down, the whole conversion engine stalls.",
  collapseRule:
    "If connections < 40 by 1:00 PM → flag to Floor Lead immediately and request support.",
  shieldBlocks: [
    { startMin: t(10, 40), endMin: t(13, 0), label: "Deep Work Block · No personal calls" },
    { startMin: t(14, 0), endMin: t(17, 0), label: "Deep Work Block · Calls only" },
  ],
  kpis: [
    { id: "conn", label: "Connections made", target: 70, kind: "count", why: "70 is the floor. Below = below quota." },
    { id: "chats", label: "Chats actioned", target: 30, kind: "count", why: "Every chat needs a next step." },
    { id: "tours", label: "Tours booked", target: 3, kind: "count", why: "3 tours/day keeps the pipeline alive." },
    { id: "followups", label: "Follow-ups sent", target: 20, kind: "count", why: "Silence = lost lead." },
    { id: "ontime", label: "At desk by 10:30", target: 1, kind: "boolean", why: "First 30 minutes set the tone." },
  ],
  sprints: [
    {
      id: "op_s1", index: 1, name: "Morning Ignition",
      startMin: t(10, 30), endMin: t(13, 0),
      objective: "Hit 40+ connections before break. CRM clean.",
      actions: [
        { time: "10:30", do: "State target aloud at stand-up", output: "Committed publicly" },
        { time: "10:40–1:00", do: "Call sprint — 40+ connections", output: "40 connections reached" },
      ],
      metric: "40+ connections. Zero ghost leads.",
    },
    {
      id: "op_s2", index: 2, name: "Chat Sweep",
      startMin: t(13, 0), endMin: t(14, 0),
      objective: "Clear all stuck WhatsApp chats before afternoon sprint.",
      actions: [
        { time: "1:00–1:45", do: "WhatsApp sweep — move every chat older than 24h", output: "Backlog cleared" },
      ],
      metric: "Zero chats stuck >24h.",
    },
    {
      id: "op_s3", index: 3, name: "Afternoon Call Push",
      startMin: t(14, 0), endMin: t(17, 0),
      objective: "Remaining 30 connections. Book 3 tours.",
      actions: [
        { time: "2:00–4:30", do: "Call sprint — remaining connections + tour bookings", output: "70 total. 3 tours." },
        { time: "4:30–5:00", do: "Follow-up sends for today's fresh leads", output: "20 follow-ups sent" },
      ],
      metric: "70 connections. 3 tours booked. 20 follow-ups sent.",
    },
    {
      id: "op_s4", index: 4, name: "EOD Wrap",
      startMin: t(17, 20), endMin: t(19, 30),
      objective: "Log results. Flag anything that needs tomorrow.",
      actions: [
        { time: "5:20–6:00", do: "Update CRM with today's outcomes", output: "CRM updated" },
        { time: "6:00–7:30", do: "EOD report + tomorrow priority list", output: "EOD submitted" },
      ],
      metric: "EOD submitted. Tomorrow's top 5 leads flagged.",
    },
  ],
  commWindows: [
    {
      id: "op_w1", label: "Morning Update", atMin: t(10, 45), channel: "WhatsApp Group",
      template: "🟢 {{name}} at desk.\nTarget today: {{conn}} connections, {{tours}} tours.\nTop lead to close: {{lead}}",
    },
    {
      id: "op_w2", label: "1 PM Check-in", atMin: t(13, 0), channel: "WhatsApp Group",
      template: "📊 1 PM:\nConnections: {{conn}}/70\nTours booked: {{tours}}/3\nBlocker (if any): {{blocker}}",
    },
    {
      id: "op_w3", label: "EOD Report", atMin: t(19, 30), channel: "WhatsApp Group",
      template: "🌙 EOD — {{date}}\nConnections: {{conn}}/70\nTours booked: {{tours}}/3\nFollowups sent: {{followups}}/20\nHard decision: {{hard}}",
    },
  ],
  eodFields: [
    { id: "conn", label: "Connections made", kind: "number" },
    { id: "tours", label: "Tours booked", kind: "number" },
    { id: "chats", label: "Chats actioned", kind: "number" },
    { id: "followups", label: "Follow-ups sent", kind: "number" },
    { id: "blocker", label: "Today's main blocker", kind: "text", placeholder: "e.g., Bad leads, no response after 5 PM." },
    { id: "hard", label: "Hard decision or flag", kind: "text" },
  ],
};

// ─── FLOOR LEAD ───────────────────────────────────────────────────────────────
// Alias to Communication Shield but keyed for "Floor Lead" role
const FLOOR_LEAD = {
  ...COMMUNICATION_SHIELD,
  id: "floor_lead",
};

// ─── ADMIN PLAYBOOK ──────────────────────────────────────────────────────────
const ADMIN_PLAYBOOK = {
  id: "admin",
  title: "System Administration",
  subtitle: "Control · Compliance · Access",
  oneLiner: "Oversee system health, manage permissions, and ensure data integrity.",
  interdependence: "Without the Admin, the system grinds to a halt.",
  collapseRule: "If system downtime > 15 mins → Page engineering immediately.",
  shieldBlocks: [{ startMin: t(9, 30), endMin: t(11, 30), label: "System Maintenance" }],
  kpis: [{ id: "uptime", label: "System Uptime", target: 99, unit: "%", kind: "percent" }],
  sprints: [
    { id: "adm_s1", index: 1, name: "Morning Systems Check", startMin: t(9, 30), endMin: t(11, 0), objective: "Verify all systems and integrations are online." },
    { id: "adm_s2", index: 2, name: "Access & Permissions Review", startMin: t(11, 30), endMin: t(13, 30), objective: "Process new user requests and role changes." },
    { id: "adm_s3", index: 3, name: "Data Audits", startMin: t(14, 30), endMin: t(16, 30), objective: "Check for anomalies in metrics and CRM." },
  ],
  commWindows: [
    { id: "adm_w1", label: "System Status Update", atMin: t(10, 0), channel: "Slack", template: "All systems operational. No major updates." },
  ],
  eodFields: [{ id: "issues", label: "System Issues Today", kind: "text" }],
};

// ─── MANAGER ALIAS ────────────────────────────────────────────────────────────
const EMPLOYEE_ALIAS = {
  ...OPERATOR_DAY,
  id: "employee",
};

const TCM_ALIAS = {
  ...PERFORMANCE_ENFORCER,
  id: "tcm",
};

const MANAGER_ALIAS = {
  ...COMMUNICATION_SHIELD,
  id: "manager",
};

// ─── HR PLAYBOOK ─────────────────────────────────────────────────────────────
const HR_PLAYBOOK = {
  id: "hr",
  title: "HR Operations",
  subtitle: "Culture · Compliance · Conflict",
  oneLiner: "Maintain the heartbeat of the organization. Drive culture, resolve conflicts, and ensure compliance.",
  interdependence: "If this fails → toxicity grows → top performers leave.",
  collapseRule: "If unresolved conflicts > 3 or attendance audit delayed > 2 hours → alert Owner.",
  shieldBlocks: [
    { startMin: t(11, 0), endMin: t(13, 0), label: "Deep Work · Paperwork" },
  ],
  kpis: [
    { id: "audit", label: "Attendance audited by 11 AM", target: 1, kind: "boolean" },
    { id: "conflicts", label: "Active conflicts resolved < 48h", target: 100, unit: "%", kind: "percent" },
  ],
  sprints: [
    { id: "hr_s1", index: 1, name: "Morning Check-in & Audit", startMin: t(10, 0), endMin: t(11, 0), objective: "Ensure everyone is present and ready." },
    { id: "hr_s2", index: 2, name: "Culture & Conflict Resolution", startMin: t(11, 30), endMin: t(13, 30), objective: "Address pressing personnel issues." },
    { id: "hr_s3", index: 3, name: "Policy & Paperwork", startMin: t(14, 30), endMin: t(16, 30), objective: "Contracts, onboarding prep, compliance." },
    { id: "hr_s4", index: 4, name: "EOD Health Check", startMin: t(17, 30), endMin: t(19, 0), objective: "Check team morale and wrap up." },
  ],
  commWindows: [
    { id: "hr_w1", label: "Morning Pulse", atMin: t(11, 0), channel: "WhatsApp Group", template: "All attendance audited. Missing: {{absent}}." },
  ],
  eodFields: [{ id: "morale", label: "General Morale (1-10)", kind: "number" }],
};

// ─── RECRUITER PLAYBOOK ──────────────────────────────────────────────────────
const RECRUITER_PLAYBOOK = {
  id: "recruiter",
  title: "Recruiting Engine",
  subtitle: "Sourcing · Screening · Closing",
  oneLiner: "Find and close top-tier talent to fuel Gharpayy's growth.",
  interdependence: "No talent → No growth.",
  collapseRule: "If pipeline < 5 qualified candidates per open role → Escalate to Owner.",
  shieldBlocks: [
    { startMin: t(11, 0), endMin: t(13, 0), label: "Screening Calls" },
    { startMin: t(14, 0), endMin: t(17, 0), label: "Interviews" },
  ],
  kpis: [
    { id: "screens", label: "Phone screens completed", target: 10, kind: "count" },
    { id: "offers", label: "Offers extended", target: 2, kind: "count" },
  ],
  sprints: [
    { id: "rec_s1", index: 1, name: "Sourcing & Pipeline", startMin: t(10, 0), endMin: t(11, 0), objective: "Find 20 new prospects." },
    { id: "rec_s2", index: 2, name: "Candidate Screening", startMin: t(11, 0), endMin: t(13, 0), objective: "Conduct initial phone screens." },
    { id: "rec_s3", index: 3, name: "Interview Coordination", startMin: t(14, 0), endMin: t(17, 0), objective: "Run or shadow technical/cultural interviews." },
    { id: "rec_s4", index: 4, name: "Offer & Follow-up", startMin: t(17, 0), endMin: t(18, 30), objective: "Draft offers and follow up with candidates." },
  ],
  commWindows: [
    { id: "rec_w1", label: "Pipeline Update", atMin: t(13, 0), channel: "WhatsApp Group", template: "Screens done: {{screens}}. Moving to next round: {{advanced}}." },
  ],
  eodFields: [{ id: "offers_sent", label: "Offers Sent", kind: "number" }],
};

// ─── ZONE LEADER PLAYBOOK ────────────────────────────────────────────────────
const ZONE_LEADER_PLAYBOOK = {
  id: "zone_leader",
  title: "Zone Command",
  subtitle: "Revenue · Blockers · Strategy",
  oneLiner: "Command the zone. Unblock Floor Leads and drive overarching revenue.",
  interdependence: "If Zone Leader is disconnected → Floor Leads run blind.",
  collapseRule: "If Zone revenue < 40% of weekly target by Wednesday → Initiate Emergency Sync.",
  shieldBlocks: [{ startMin: t(14, 0), endMin: t(16, 0), label: "Strategy & Reviews" }],
  kpis: [
    { id: "rev", label: "Zone Revenue vs Target", target: 100, unit: "%", kind: "percent" },
  ],
  sprints: [
    { id: "zl_s1", index: 1, name: "Zone Kickoff", startMin: t(10, 0), endMin: t(11, 0), objective: "Review metrics across all floors." },
    { id: "zl_s2", index: 2, name: "Floor Lead Syncs", startMin: t(11, 30), endMin: t(13, 0), objective: "1:1 coaching with Floor Leads." },
    { id: "zl_s3", index: 3, name: "Escalations & Blockers", startMin: t(14, 0), endMin: t(16, 0), objective: "Resolve high-level client or operational blockers." },
    { id: "zl_s4", index: 4, name: "Zone EOD Review", startMin: t(17, 30), endMin: t(19, 0), objective: "Consolidate floor reports and plan tomorrow." },
  ],
  commWindows: [
    { id: "zl_w1", label: "Zone Alignment", atMin: t(11, 0), channel: "WhatsApp Group", template: "Zone target: {{target}}. Major focus: {{focus}}." },
  ],
  eodFields: [{ id: "zone_rev", label: "Revenue Booked", kind: "number" }],
};

// ─── OWNER PLAYBOOK ──────────────────────────────────────────────────────────
const OWNER_PLAYBOOK = {
  id: "owner",
  title: "Executive Command",
  subtitle: "Vision · Strategy · Expansion",
  oneLiner: "Drive the vision. Review high-level metrics and execute strategic decisions.",
  interdependence: "Owner provides the map. Without it, the team wanders.",
  collapseRule: "If cash runway < 3 months → Halt expansion, pivot to sales.",
  shieldBlocks: [{ startMin: t(9, 0), endMin: t(12, 0), label: "Deep Work" }],
  kpis: [{ id: "growth", label: "MoM Growth", target: 20, unit: "%", kind: "percent" }],
  sprints: [
    { id: "ow_s1", index: 1, name: "Executive Dashboard", startMin: t(9, 0), endMin: t(10, 30), objective: "Review company-wide health metrics." },
    { id: "ow_s2", index: 2, name: "Leadership Sync", startMin: t(11, 0), endMin: t(13, 0), objective: "Meet with Zone Leaders and HR." },
    { id: "ow_s3", index: 3, name: "Strategic Deep Work", startMin: t(14, 0), endMin: t(17, 0), objective: "Product, Partnerships, Expansion planning." },
  ],
  commWindows: [
    { id: "ow_w1", label: "Daily Pulse", atMin: t(13, 0), channel: "Slack", template: "Key decision today: {{decision}}." },
  ],
  eodFields: [{ id: "big_win", label: "Biggest Win", kind: "text" }],
};

// ─── COACH PLAYBOOK ──────────────────────────────────────────────────────────
const COACH_PLAYBOOK = {
  id: "coach",
  title: "Performance Coaching",
  subtitle: "Training · Pitching · Excellence",
  oneLiner: "Level up the team. Listen, train, and correct performance.",
  interdependence: "Bad coaching → low conversion rates.",
  collapseRule: "If C-player conversion remains < 5% after 2 weeks → flag to HR.",
  shieldBlocks: [{ startMin: t(11, 0), endMin: t(15, 0), label: "Live Call Listening" }],
  kpis: [{ id: "coached", label: "Agents Coached Today", target: 5, kind: "count" }],
  sprints: [
    { id: "co_s1", index: 1, name: "Metric Review", startMin: t(10, 0), endMin: t(11, 0), objective: "Identify who needs coaching today." },
    { id: "co_s2", index: 2, name: "Live Call Listening", startMin: t(11, 0), endMin: t(14, 0), objective: "Shadow calls silently and take notes." },
    { id: "co_s3", index: 3, name: "1:1 Coaching", startMin: t(14, 30), endMin: t(17, 30), objective: "Deliver feedback and practice pitches." },
  ],
  commWindows: [
    { id: "co_w1", label: "Training Focus", atMin: t(10, 30), channel: "WhatsApp Group", template: "Today's pitch focus: {{focus}}." },
  ],
  eodFields: [{ id: "top_improver", label: "Top Improver", kind: "text" }],
};

// ─── PROPERTY PARTNER PLAYBOOK ───────────────────────────────────────────────
const PROPERTY_PARTNER_PLAYBOOK = {
  id: "property_partner",
  title: "Property & Partner Ops",
  subtitle: "Inventory · Landlords · Maintenance",
  oneLiner: "Ensure inventory is tour-ready and landlord relations are strong.",
  interdependence: "If property isn't ready → Tours fail → Revenue drops.",
  collapseRule: "If tour-ready inventory < 10 units → Pause new marketing.",
  shieldBlocks: [{ startMin: t(13, 0), endMin: t(16, 0), label: "Field Work" }],
  kpis: [{ id: "ready", label: "Tour-ready units", target: 20, kind: "count" }],
  sprints: [
    { id: "pp_s1", index: 1, name: "Inventory Status Check", startMin: t(10, 0), endMin: t(11, 30), objective: "Verify what's available today." },
    { id: "pp_s2", index: 2, name: "Landlord Follow-ups", startMin: t(11, 30), endMin: t(13, 0), objective: "Chase pending approvals and contracts." },
    { id: "pp_s3", index: 3, name: "Maintenance & Tour Prep", startMin: t(14, 0), endMin: t(17, 0), objective: "Ensure keys work, properties are clean." },
  ],
  commWindows: [
    { id: "pp_w1", label: "Inventory Update", atMin: t(11, 30), channel: "WhatsApp Group", template: "New units added: {{new}}. Total ready: {{total}}." },
  ],
  eodFields: [{ id: "issues", label: "Maintenance Blockers", kind: "text" }],
};

// ─── FLOW OPS PLAYBOOK ───────────────────────────────────────────────────────
const FLOW_OPS_PLAYBOOK = {
  id: "flow_ops",
  title: "Flow Operations",
  subtitle: "Pitch · Follow-up · Close",
  oneLiner: "Keep the deals flowing. Perfect the pitch and confirm the show-ups.",
  interdependence: "If Flow Ops fails → Tours ghost → Revenue vanishes.",
  collapseRule: "If < 20 follow-ups by 2 PM → Immediate check-in with Floor Lead.",
  shieldBlocks: [{ startMin: t(14, 0), endMin: t(17, 0), label: "Closing Sprint" }],
  kpis: [{ id: "shows", label: "Tours Showed Up", target: 5, kind: "count" }],
  sprints: [
    { id: "fo_s1", index: 1, name: "Follow-up Blitz", startMin: t(10, 30), endMin: t(12, 30), objective: "Confirm all today's tours." },
    { id: "fo_s2", index: 2, name: "New Lead Pitching", startMin: t(13, 30), endMin: t(15, 30), objective: "Call every new lead under 5 minutes." },
    { id: "fo_s3", index: 3, name: "Closing Deals", startMin: t(16, 0), endMin: t(18, 30), objective: "Push pending contracts over the line." },
  ],
  commWindows: [
    { id: "fo_w1", label: "Midday Flow", atMin: t(13, 30), channel: "WhatsApp Group", template: "Tours confirmed: {{confirmed}}. Deals in progress: {{deals}}." },
  ],
  eodFields: [{ id: "closed", label: "Deals Closed", kind: "number" }],
};

// ─── GENERAL EMPLOYEE PLAYBOOK ─────────────────────────────────────────────────
const EMPLOYEE_PLAYBOOK = {
  id: "employee",
  title: "Standard Operations",
  subtitle: "Focus · Execution · Delivery",
  oneLiner: "Execute your core tasks with deep focus and align with team goals.",
  interdependence: "Your output is the input for the rest of the team.",
  collapseRule: "If blocked for > 2 hours → Escalate to your Manager.",
  shieldBlocks: [{ startMin: t(10, 30), endMin: t(12, 30), label: "Morning Deep Work" }],
  kpis: [{ id: "tasks", label: "Tasks Completed", target: 5, kind: "count" }],
  sprints: [
    { id: "emp_s1", index: 1, name: "Morning Kickoff & Alignment", startMin: t(10, 0), endMin: t(10, 30), objective: "Plan the day and align with leadership." },
    { id: "emp_s2", index: 2, name: "Morning Deep Work", startMin: t(10, 30), endMin: t(13, 0), objective: "Execute highest priority tasks uninterrupted." },
    { id: "emp_s3", index: 3, name: "Collaboration & Meetings", startMin: t(14, 0), endMin: t(16, 0), objective: "Sync with team members and unblock issues." },
    { id: "emp_s4", index: 4, name: "Afternoon Deep Work & Wrap", startMin: t(16, 0), endMin: t(18, 30), objective: "Finish daily tasks and prepare EOD report." },
  ],
  commWindows: [
    { id: "emp_w1", label: "Daily Sync", atMin: t(10, 30), channel: "Slack", template: "Today's priority: {{priority}}. Blockers: {{blockers}}." },
  ],
  eodFields: [{ id: "completed", label: "Major Output Today", kind: "text" }],
};

// ─── ALL PLAYBOOKS ────────────────────────────────────────────────────────────
export const PLAYBOOKS_TO_SEED = [
  COMMUNICATION_SHIELD,
  FLOOR_LEAD,
  PERFORMANCE_ENFORCER,
  OPERATOR_DAY,
  ADMIN_PLAYBOOK,
  MANAGER_ALIAS,
  HR_PLAYBOOK,
  RECRUITER_PLAYBOOK,
  ZONE_LEADER_PLAYBOOK,
  OWNER_PLAYBOOK,
  COACH_PLAYBOOK,
  PROPERTY_PARTNER_PLAYBOOK,
  FLOW_OPS_PLAYBOOK,
  EMPLOYEE_PLAYBOOK,
  TCM_ALIAS,
];

/**
 * Idempotent: upserts all playbooks into DB.
 * Only creates if not present; updates if content has changed.
 */
export async function seedPlaybooks() {
  const results = [];
  for (const pb of PLAYBOOKS_TO_SEED) {
    const r = await Playbook.updateOne(
      { id: pb.id },
      { $set: pb },
      { upsert: true }
    );
    results.push({
      id: pb.id,
      inserted: r.upsertedCount > 0,
      updated: r.modifiedCount > 0,
    });
  }
  console.log("[seedPlaybooks] seeded", results.length, "playbooks");
  return results;
}
