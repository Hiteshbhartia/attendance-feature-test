import mongoose, { Schema, Document } from 'mongoose';

// ─── Architecture note ────────────────────────────────────────────────────────
// KPIs and Sprint Plans are owned by TEAMS (HR Team, Recruitment Team, etc.)
// NOT by hierarchy roles (Manager, Employee) or playbook roles (recruiter, coach).
//
// teamName = operational grouping → owns KPIs, sprints, Arena dashboards
// hierarchyRole = authority level → owns permissions, reporting, approvals
// ─────────────────────────────────────────────────────────────────────────────

// 1. KPI Definition — owned by a Team
export interface IArenaKPIDefinition extends Document {
  /** The team that owns this KPI, e.g. "HR Team", "Recruitment Team" */
  teamName: string;
  kpiName: string;
  label: string;
  type: 'NUMBER' | 'BOOLEAN';
  target: any;
  orderIndex: number;
  isActive: boolean;
}

const ArenaKPIDefinitionSchema = new Schema({
  teamName:   { type: String, required: true },
  kpiName:    { type: String, required: true },
  label:      { type: String, required: true },
  type:       { type: String, enum: ['NUMBER', 'BOOLEAN'], default: 'NUMBER' },
  target:     { type: Schema.Types.Mixed, default: 0 },
  orderIndex: { type: Number, default: 0 },
  isActive:   { type: Boolean, default: true },
});

// 2. Sprint Plan — owned by a Team
export interface IArenaSprintPlan extends Document {
  /** The team that owns this sprint plan */
  teamName: string;
  sprintName: string;
  startTime: string;
  endTime: string;
  orderIndex: number;
}

const ArenaSprintPlanSchema = new Schema({
  teamName:   { type: String, required: true },
  sprintName: { type: String, required: true },
  startTime:  { type: String, required: true },
  endTime:    { type: String, required: true },
  orderIndex: { type: Number, default: 0 },
});

// 2.5 Communication Windows - Admin defined
export interface IArenaCommWindow extends Document {
  role: string;
  windowName: string;
  scheduledTime: string; // e.g. "10:00 AM"
  orderIndex: number;
}

const ArenaCommWindowSchema = new Schema({
  role: { type: String, required: true },
  windowName: { type: String, required: true },
  scheduledTime: { type: String, required: true },
  orderIndex: { type: Number, default: 0 },
});


// 3. Daily State - Employee progress
export interface IArenaDailyState extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  kpis: {
    [key: string]: {
      value: number;
      isDone: boolean;
      updatedAt: Date;
    }
  };
  sprints: {
    [index: number]: {
      isDone: boolean;
      updatedAt: Date;
    }
  };
  comms: {
    [index: number]: {
      status: 'SENT' | 'MISSED';
      updatedAt: Date;
    }
  };
  decisions: {
    text: string;
    timestamp: Date;
  }[];
  eodReport: {
    summary?: string; // Legacy support
    goalAchieved?: string; // 'Yes', 'No', 'Partially'
    whatWasDone?: string;
    liveLinks?: { label: string; url: string }[];
    submittedAt: Date;
  };
  shieldMode: boolean;
}

const ArenaDailyStateSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'GpAttUser', required: true },
  date: { type: String, required: true },
  kpis: { type: Map, of: new Schema({
    value: Number,
    isDone: Boolean,
    updatedAt: { type: Date, default: Date.now }
  }, { _id: false }), default: {} },
  sprints: { type: Map, of: new Schema({
    isDone: Boolean,
    updatedAt: { type: Date, default: Date.now }
  }, { _id: false }), default: {} },
  comms: { type: Map, of: new Schema({
    status: { type: String, enum: ['SENT', 'MISSED'] },
    updatedAt: { type: Date, default: Date.now }
  }, { _id: false }), default: {} },
  decisions: [{
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  eodReport: {
    summary: { type: String, default: '' }, // Legacy
    goalAchieved: { type: String, enum: ['Yes', 'No', 'Partially'] },
    whatWasDone: { type: String },
    liveLinks: [{
      label: { type: String },
      url: { type: String }
    }],
    submittedAt: { type: Date }
  },
  shieldMode: { type: Boolean, default: false },
});

// Indexes for fast lookup
ArenaDailyStateSchema.index({ userId: 1, date: 1 }, { unique: true });
ArenaKPIDefinitionSchema.index({ teamName: 1, kpiName: 1 }, { unique: true });
ArenaSprintPlanSchema.index({ teamName: 1, sprintName: 1 });

// Export models with defensive registration and explicit collection names
export const ArenaKPIDefinition = mongoose.models?.ArenaKPIDefinition || 
  mongoose.model<IArenaKPIDefinition>('ArenaKPIDefinition', ArenaKPIDefinitionSchema, 'arenakpidefinitions');

export const ArenaSprintPlan = mongoose.models?.ArenaSprintPlan || 
  mongoose.model<IArenaSprintPlan>('ArenaSprintPlan', ArenaSprintPlanSchema, 'arenasprintplans');

export const ArenaCommWindow = mongoose.models?.ArenaCommWindow || 
  mongoose.model<IArenaCommWindow>('ArenaCommWindow', ArenaCommWindowSchema, 'arenacommwindows');

export const ArenaDailyState = mongoose.models?.ArenaDailyState || 
  mongoose.model<IArenaDailyState>('ArenaDailyState', ArenaDailyStateSchema, 'arenadailystates');
