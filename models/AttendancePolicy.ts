import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAttendancePolicy extends Document {
  name: string;
  orgId?: mongoose.Types.ObjectId;
  isDefault: boolean;

  // Late arrival
  graceMinutes: number;
  lateMarkAfterMinutes: number;
  halfDayThresholdMinutes: number;
  absentThresholdMinutes: number;
  latePenaltyEnabled: boolean;
  latePenaltyType: 'fixed' | 'per_minute';
  latePenaltyValue: number;

  // Working hours
  standardWorkingHoursPerDay: number;
  weekOffs: string[];
  weeklyOffDays: string[]; // alias for weekOffs used in leaves calculation

  // Overtime
  overtimeEnabled: boolean;
  overtimeAfterMinutes: number;
  compOffEnabled: boolean;
  overtimeMultiplier: number;
  maxOvertimeHoursPerDay: number;
  maxOvertimeHoursPerMonth: number;

  // Exclusions
  holidayExclusionEnabled: boolean;
  weeklyOffExclusionEnabled: boolean;

  // Deduction
  lopDeductionEnabled: boolean;

  // IP Restriction
  ipRestrictionEnabled: boolean;
  allowedIPs: string[];

  // Auto absent
  autoMarkAbsent: boolean;
  autoMarkAbsentAfterMidnight: boolean;

  updatedBy?: mongoose.Types.ObjectId;
  updatedAt?: Date;
  createdAt?: Date;
}

const AttendancePolicySchema = new Schema<IAttendancePolicy>(
  {
    name: { type: String, default: 'Default Policy' },
    orgId: { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    isDefault: { type: Boolean, default: false },

    // Late arrival
    graceMinutes: { type: Number, default: 10, min: 0, max: 180 },
    lateMarkAfterMinutes: { type: Number, default: 15, min: 0, max: 120 },
    halfDayThresholdMinutes: { type: Number, default: 120, min: 60, max: 300 },
    absentThresholdMinutes: { type: Number, default: 240, min: 120, max: 480 },
    latePenaltyEnabled: { type: Boolean, default: false },
    latePenaltyType: { type: String, enum: ['fixed', 'per_minute'], default: 'fixed' },
    latePenaltyValue: { type: Number, default: 0 },

    // Working hours
    standardWorkingHoursPerDay: { type: Number, default: 8, min: 4, max: 12 },
    weekOffs: { type: [String], default: ['Sunday'] },
    weeklyOffDays: { type: [String], default: ['Sunday'] }, // alias for weekOffs

    // Overtime
    overtimeEnabled: { type: Boolean, default: true },
    overtimeAfterMinutes: { type: Number, default: 30 },
    compOffEnabled: { type: Boolean, default: false },
    overtimeMultiplier: { type: Number, default: 1.5, min: 1, max: 5 },
    maxOvertimeHoursPerDay: { type: Number, default: 4, min: 0, max: 12 },
    maxOvertimeHoursPerMonth: { type: Number, default: 50, min: 0, max: 100 },

    // Exclusions
    holidayExclusionEnabled: { type: Boolean, default: true },
    weeklyOffExclusionEnabled: { type: Boolean, default: true },

    // Deduction
    lopDeductionEnabled: { type: Boolean, default: false },

    // IP Restriction
    ipRestrictionEnabled: { type: Boolean, default: false },
    allowedIPs: { type: [String], default: [] },

    // Auto absent
    autoMarkAbsent: { type: Boolean, default: true },
    autoMarkAbsentAfterMidnight: { type: Boolean, default: true },

    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const AttendancePolicy: Model<IAttendancePolicy> =
  mongoose.models.AttendancePolicy ||
  mongoose.model<IAttendancePolicy>('AttendancePolicy', AttendancePolicySchema);

export default AttendancePolicy;
