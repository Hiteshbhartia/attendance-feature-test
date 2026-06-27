import mongoose from "mongoose";

const { Schema } = mongoose;

// --- User (auth) ---
const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    employeeId: { type: String, index: true }, // links to Employee.id for employees
    manageId: { type: String, index: true }, // links to Employee.id for managers
    role: {
      type: String,
      enum: ["admin", "hr", "manager", "employee"],
      default: "employee",
    },
    isApproved: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "configured", "active", "suspended", "rejected"],
      default: "pending",
    },
    name: { type: String },
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// --- Employee ---
const EmployeeSchema = new Schema(
  {
    id: { type: String, required: true, unique: true }, // stable id used by frontend (e1..e15)
    name: { type: String, required: true },
    role: { type: String, required: true }, // Floor Lead / Operator / TCM / HR / etc
    title: String,
    avatarColor: String,
    managerId: String,
    hubId: String,
    email: String,
    phone: String,
    joinedAt: Number,
    birthday: String,
    skills: [String],
    /** Full frontend Employee metrics (scores, zone, flags, etc.) */
    profile: { type: Schema.Types.Mixed },
    hideTasks: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// --- Attendance ---
const AttendanceSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    checkInAt: Number,
    checkOutAt: Number,
    status: { type: String, enum: ["present", "late", "absent", "leave"], default: "present" },
    selfieUrl: String,
    note: String,
    minutesWorked: Number,
  },
  { timestamps: true },
);
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// --- Attendance events (clock in/out stream) ---
const AttendanceEventSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: ["clock_in", "clock_out", "break_start", "break_end", "field_start", "field_end"],
      required: true,
    },
    ts: { type: Number, required: true, index: true },
    lat: Number,
    lng: Number,
    accuracy: Number,
    address: String,
    selfie: String,
    createdById: String,
  },
  { timestamps: true },
);

// --- Task (full AppTask payload) ---
const TaskSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: String,
    assigneeId: { type: String, index: true },
    assignedById: String,
    createdById: String,
    dueAt: Number,
    createdAt: Number,
    priority: { type: String, enum: ["low", "med", "high", "urgent"], default: "med" },
    status: { type: String, enum: ["todo", "doing", "done", "blocked"], default: "todo" },
    tags: [String],
    completedAt: Number,
    relatedTo: String,
    source: { type: String, enum: ["manual", "auto"] },
    estimateMin: Number,
    subtasks: [{ id: String, title: String, done: Boolean }],
    comments: [{ id: String, authorId: String, body: String, ts: Number }],
    activity: [{ id: String, kind: String, byId: String, detail: String, ts: Number }],
    links: [{ id: String, label: String, url: String, kind: String, sizeKb: Number }],
    timeLogs: [{ id: String, byId: String, startAt: Number, endAt: Number, note: String }],
  },
  { timestamps: true },
);

// --- Leave ---
const LeaveSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    type: { type: String, enum: ["Casual", "Sick", "Earned", "Unpaid", "WFH"], required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    reason: String,
    appliedAt: Number,
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedById: String,
    reviewNote: String,
  },
  { timestamps: true },
);

// --- Kudos ---
const KudoSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    fromId: { type: String, required: true },
    toId: { type: String, required: true, index: true },
    tag: String,
    message: String,
    ts: Number,
  },
  { timestamps: true },
);

// --- Calendar event ---
const CalEventSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: [
        "shift",
        "tour",
        "task",
        "leave",
        "holiday",
        "birthday",
        "1:1",
        "town_hall",
        "anniversary",
      ],
      required: true,
    },
    title: String,
    startAt: Number,
    endAt: Number,
    ownerId: String,
    note: String,
  },
  { timestamps: true },
);

// --- Notification ---
const NotificationSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    kind: {
      type: String,
      enum: ["approval", "task", "kudos", "attendance", "mention", "coach", "calendar", "system"],
      required: true,
    },
    toId: { type: String, required: true, index: true },
    fromId: String,
    title: String,
    body: String,
    actionLabel: String,
    actionTo: String,
    ts: Number,
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// --- 1:1 ---
const ActionItemSchema = new Schema(
  {
    id: String,
    text: String,
    title: String,
    ownerId: String,
    dueAt: Number,
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

const OneOnOneSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    managerId: { type: String, required: true, index: true },
    reportId: { type: String, required: true, index: true },
    scheduledAt: Number,
    durationMin: { type: Number, default: 30 },
    status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
    sentiment: { type: String, enum: ["green", "amber", "red"] },
    agenda: String,
    notes: String,
    privateNotes: String,
    actionItems: [ActionItemSchema],
  },
  { timestamps: true },
);

// --- Recruiting ---
const CandidateNoteSchema = new Schema(
  { id: String, authorId: String, body: String, ts: Number },
  { _id: false },
);

const CandidateSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: String,
    phone: String,
    role: String,
    source: String,
    recruiterId: { type: String, index: true },
    stage: {
      type: String,
      enum: ["applied", "screen", "interview", "offer", "hired", "rejected"],
      default: "applied",
    },
    rejectReason: String,
    appliedAt: Number,
    notes: [CandidateNoteSchema],
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true, strict: false },
);

// --- Console (per-day per-actor playbook progress) ---
const ConsoleStateSchema = new Schema(
  {
    id: { type: String, required: true, unique: true }, // `${actorId}:${date}`
    actorId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    createdById: String,
    sprintsDone: [String],
    kpis: { type: Map, of: Number, default: {} },
    sentWindows: [String],
    eodDraft: String,
    hardDecisions: String,
    /** Full frontend DayState blob when present */
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
ConsoleStateSchema.index({ actorId: 1, date: 1 }, { unique: true });

// --- Pulse ---
const PulseEntrySchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: String,
    role: String,
    team: String,
    zone: String,
    date: { type: String, required: true, index: true },
    slot: { type: String, enum: ["slot1", "slot2", "slot3", "eod"], required: true },
    text: String,
    calls: Number,
    tours: Number,
    closures: Number,
    blockers: String,
    mediaUrl: String,
    mediaUrls: [String],
    submittedAt: Number,
    onTime: Boolean,
    createdById: String,
  },
  { timestamps: true },
);
PulseEntrySchema.index({ employeeId: 1, date: 1, slot: 1 }, { unique: true });

// --- Fly board ---
const FlyCommentSchema = new Schema(
  { id: String, authorId: String, body: String, ts: Number },
  { _id: false },
);

const FlyUpdateSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    authorId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    connectedCalls: Number,
    visitsScheduled: Number,
    visitsCompleted: Number,
    hotLeads: Number,
    bookings: Number,
    blocker: String,
    propertyIssue: String,
    tomorrowPriority: String,
    zone: String,
    createdAt: Number,
    createdById: String,
  },
  { timestamps: true },
);

const FlyRetroSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    kind: { type: String, enum: ["start", "stop", "continue"], required: true },
    authorId: { type: String, required: true, index: true },
    body: String,
    createdAt: Number,
    upvotes: [String],
    comments: [FlyCommentSchema],
    createdById: String,
  },
  { timestamps: true },
);

const FlyFeedSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    kind: {
      type: String,
      enum: ["visit", "lead", "blocker", "callback", "booking", "issue", "win", "system"],
      required: true,
    },
    authorId: { type: String, required: true, index: true },
    zone: String,
    property: String,
    body: String,
    ts: Number,
    upvotes: [String],
    comments: [FlyCommentSchema],
    createdById: String,
  },
  { timestamps: true },
);

// --- KPI Governance ---
const KpiDefinitionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: String,
    category: { type: String, default: "General" },
    unit: { type: String, default: "count" }, // %, count, hours, etc.
    frequency: { type: String, default: "daily" }, // daily, weekly, monthly
    aggregationType: { type: String, default: "sum" }, // sum, average, max, min, last
    visibilityScope: { type: String, default: "public" }, // public, team, leadership, hr
    ownerRole: { type: String, default: "Operator" },
    targetType: { type: String, default: "min" }, // min, max, exact
    active: { type: Boolean, default: true },
    archivedAt: Number,
    deprecated: { type: Boolean, default: false },
    replacedBy: String, // id of replacement KPI definition
    version: { type: Number, default: 1 },
    createdBy: String,
    updatedBy: String,
    history: [
      {
        version: Number,
        updatedBy: String,
        updatedAt: Number,
        changes: Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true },
);

const KpiTargetSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    kpiId: { type: String, required: true, index: true },
    scopeType: { type: String, enum: ["org", "zone", "team", "individual"], required: true },
    scopeId: { type: String, required: true, index: true }, // "org", zone name, team/hubId, or employeeId
    targetValue: { type: Number, required: true },
    effectiveFrom: { type: String, required: true }, // YYYY-MM-DD
    effectiveTo: { type: String, required: true }, // YYYY-MM-DD
    ownerId: String, // employee ID who owns/manages this target or who is the target subject
    notes: String,
    version: { type: Number, default: 1 },
    updatedBy: String,
    history: [
      {
        version: Number,
        targetValue: Number,
        effectiveFrom: String,
        effectiveTo: String,
        updatedBy: String,
        updatedAt: Number,
        notes: String,
      },
    ],
  },
  { timestamps: true },
);

export const User = mongoose.model("User", UserSchema);
export const Employee = mongoose.model("Employee", EmployeeSchema);
export const Attendance = mongoose.model("Attendance", AttendanceSchema);
export const AttendanceEvent = mongoose.model("AttendanceEvent", AttendanceEventSchema);
export const Task = mongoose.model("Task", TaskSchema);
export const Leave = mongoose.model("Leave", LeaveSchema);
export const Kudo = mongoose.model("Kudo", KudoSchema);
export const CalEvent = mongoose.model("CalEvent", CalEventSchema);
export const Notification = mongoose.model("Notification", NotificationSchema);
export const OneOnOne = mongoose.model("OneOnOne", OneOnOneSchema);
export const Candidate = mongoose.model("Candidate", CandidateSchema);
export const ConsoleState = mongoose.model("ConsoleState", ConsoleStateSchema);
export const PulseEntry = mongoose.model("PulseEntry", PulseEntrySchema);
export const FlyUpdate = mongoose.model("FlyUpdate", FlyUpdateSchema);
export const FlyRetro = mongoose.model("FlyRetro", FlyRetroSchema);
export const FlyFeed = mongoose.model("FlyFeed", FlyFeedSchema);
export const KpiDefinition = mongoose.model("KpiDefinition", KpiDefinitionSchema);
export const KpiTarget = mongoose.model("KpiTarget", KpiTargetSchema);

// --- Chat System ---
const ChatThreadSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    participantIds: [{ type: String, required: true, index: true }],
    lastMessage: String,
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { timestamps: true }
);

const ChatMessageSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    threadId: { type: String, required: true, index: true },
    fromId: { type: String, required: true, index: true },
    body: { type: String, required: true },
    ts: { type: Number, default: () => Date.now() },
    actionType: { type: String }, // leave_request, leave_approved, etc.
    actionPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const ChatThread = mongoose.model("ChatThread", ChatThreadSchema);
export const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);

// --- FCM Tokens ---
const FCMTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    employeeId: { type: String, index: true },
    deviceType: { type: String, default: "web" },
  },
  { timestamps: true }
);
export const FCMToken = mongoose.model("FCMToken", FCMTokenSchema);

// --- Zones & Properties ---
const ZoneSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    city: { type: String, required: true },
    pods: { type: Number, default: 0 },
    leaderId: { type: String, index: true },
    type: { type: String }, // "PG" or "Flat"
  },
  { timestamps: true }
);

const PropertySchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    zoneId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    address: { type: String },
    rating: { type: Number, default: 0 },
    beds: { type: Number, default: 0 },
    occupied: { type: Number, default: 0 },
    monthlyRevenue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// --- Playbooks ---
const PlaybookSchema = new Schema(
  {
    id: { type: String, required: true, unique: true }, // The key used in frontend
    title: { type: String, required: true },
    steps: { type: Schema.Types.Mixed, default: [] },
    shieldBlocks: { type: Schema.Types.Mixed, default: [] },
    sprints: { type: Schema.Types.Mixed, default: [] },
    commWindows: { type: Schema.Types.Mixed, default: [] },
    kpis: { type: Schema.Types.Mixed, default: [] },
    eodFields: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

export const Zone = mongoose.model("Zone", ZoneSchema);
export const Property = mongoose.model("Property", PropertySchema);
export const Playbook = mongoose.model("Playbook", PlaybookSchema);

// --- Permissions ---
const RolePermissionSchema = new Schema(
  {
    role: { type: String, required: true, index: true },
    feature: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    updatedBy: String,
  },
  { timestamps: true }
);
RolePermissionSchema.index({ role: 1, feature: 1 }, { unique: true });

// --- Audit Logs ---
const AuditLogSchema = new Schema(
  {
    action: { type: String, required: true },
    role: String,
    feature: String,
    performedBy: String,
    details: Schema.Types.Mixed,
    ts: { type: Number, default: () => Date.now() },
  },
  { timestamps: true }
);

export const RolePermission = mongoose.model("RolePermission", RolePermissionSchema);
export const AuditLog = mongoose.model("AuditLog", AuditLogSchema);


