/** Domain types for Gharpayy Arena HRMS (no runtime demo data). */

export type Tier = "A" | "B" | "C" | "D";
export type Role =
  | "Admin"
  | "Zone Leader"
  | "Floor Lead"
  | "Operator"
  | "Flow Ops"
  | "TCM"
  | "HR"
  | "Owner"
  | "Coach"
  | "Recruiter"
  | "Property Partner";
export type AppRole = "admin" | "hr" | "manager" | "employee";

export interface Employee {
  id: string;
  name: string;
  role: Role;
  appRole: AppRole;
  experience: "New" | "Mid" | "Core";
  attendance: number;
  performance: number;
  consistency: number;
  revenueImpact: number;
  taskCompletion: number;
  conversion: number;
  callsToday: number;
  callTarget: number;
  leadsActive: number;
  closedDeals: number;
  lostDeals: number;
  flags: string[];
  status: "Active" | "Idle" | "Late" | "Offline";
  streakDays: number;
  team: string;
  shift: string;
  avatarSeed: string;
  zone?: string;
  managerId?: string | null;
  bio?: string;
  joinedYearsAgo?: number;
  birthdayMMDD?: string;
  hideTasks?: boolean;
  email?: string;
  joinedAt?: number;
  birthday?: string;
}

export type KudoTag =
  | "Hustle"
  | "Customer Love"
  | "Team Player"
  | "Above & Beyond"
  | "Bug Fixer"
  | "Streak Hero";

export interface Kudo {
  id: string;
  fromId: string;
  toId: string;
  tag: KudoTag;
  message: string;
  ts: number;
}

export type TaskStatus = "todo" | "doing" | "done" | "blocked";
export type TaskPriority = "low" | "med" | "high" | "urgent";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  authorId: string;
  body: string;
  ts: number;
}

export type ActivityKind =
  | "created"
  | "status"
  | "priority"
  | "due"
  | "assignee"
  | "subtask_add"
  | "subtask_toggle"
  | "comment"
  | "link_add"
  | "attachment_add"
  | "timer_start"
  | "timer_stop";

export interface TaskActivity {
  id: string;
  kind: ActivityKind;
  byId: string;
  detail: string;
  ts: number;
}

export interface TaskLink {
  id: string;
  label: string;
  url?: string;
  kind?: "lead" | "tour" | "doc" | "url" | "file";
  sizeKb?: number;
}

export interface TimeLog {
  id: string;
  byId: string;
  startAt: number;
  endAt?: number;
  note?: string;
}

export interface AppTask {
  id: string;
  title: string;
  description?: string;
  assigneeId: string;
  assignedById: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: number;
  createdAt: number;
  completedAt?: number;
  relatedTo?: string;
  source?: "manual" | "auto";
  estimateMin?: number;
  subtasks?: Subtask[];
  comments?: TaskComment[];
  activity?: TaskActivity[];
  links?: TaskLink[];
  timeLogs?: TimeLog[];
}

export type LeaveType = "Casual" | "Sick" | "Earned" | "Unpaid" | "WFH";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface AppLeave {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  appliedAt: number;
  reviewedById?: string;
  reviewNote?: string;
}

export type CalEventType =
  | "shift"
  | "tour"
  | "task"
  | "leave"
  | "holiday"
  | "birthday"
  | "1:1"
  | "town_hall"
  | "anniversary";

export interface CalEvent {
  id: string;
  type: CalEventType;
  title: string;
  startAt: number;
  endAt: number;
  ownerId?: string;
  withIds?: string[];
  location?: string;
  note?: string;
}

export type NotifKind =
  | "approval"
  | "task"
  | "kudos"
  | "attendance"
  | "mention"
  | "coach"
  | "system"
  | "calendar";

export interface AppNotif {
  id: string;
  kind: NotifKind;
  toId: string;
  fromId?: string;
  title: string;
  body: string;
  ts: number;
  read: boolean;
  actionLabel?: string;
  actionTo?: string;
}

export interface Anomaly {
  id: string;
  employeeId: string;
  kind: "no_clockin" | "no_clockout" | "no_selfie" | "outside_zone" | "long_break";
  detail: string;
  ts: number;
}

export type OneOnOneSentiment = "green" | "amber" | "red";

export interface OneOnOneActionItem {
  id: string;
  title: string;
  ownerId: string;
  done: boolean;
  dueAt?: number;
}

export interface OneOnOne {
  id: string;
  managerId: string;
  reportId: string;
  scheduledAt: number;
  durationMin: number;
  status: "scheduled" | "completed" | "skipped";
  sentiment?: OneOnOneSentiment;
  agenda: string;
  notes: string;
  privateNotes?: string;
  actionItems: OneOnOneActionItem[];
  meetingType?: "in-person" | "remote";
  meetingLink?: string;
  createdAt: number;
  updatedAt: number;
}

export type CandidateStage = "applied" | "screen" | "interview" | "offer" | "hired" | "rejected";
export type CandidateSource = "Referral" | "LinkedIn" | "Naukri" | "Walk-in" | "Inbound" | "Agency";

export interface CandidateNote {
  id: string;
  authorId: string;
  body: string;
  ts: number;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleApplied: Role;
  stage: CandidateStage;
  source: CandidateSource;
  rating: 1 | 2 | 3 | 4 | 5;
  recruiterId: string;
  expectedSalary: number;
  experience: string;
  city: string;
  appliedAt: number;
  nextStepAt?: number;
  nextStepLabel?: string;
  notes: CandidateNote[];
  rejectReason?: string;
}

export const CAND_STAGE_LABEL: Record<CandidateStage, string> = {
  applied: "Applied",
  screen: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

export const CAND_STAGE_ORDER: CandidateStage[] = [
  "applied",
  "screen",
  "interview",
  "offer",
  "hired",
  "rejected",
];

export interface ChatMessage {
  id: string;
  threadId: string;
  fromId: string;
  body: string;
  ts: number;
  // If the message contains an action widget (e.g. Leave Request)
  actionType?: "leave_request" | "leave_approved" | "leave_rejected";
  actionPayload?: {
    leaveId?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
    type?: LeaveType;
  };
}

export interface ChatThread {
  id: string;
  participantIds: string[]; // typically [employeeId, adminId]
  updatedAt: number;
  lastMessage?: string;
}
