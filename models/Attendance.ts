import mongoose, { Schema, Document } from 'mongoose';

export interface ISession {
  checkIn: Date;
  checkOut: Date | null;
  type: 'work' | 'break' | 'field';
  minutes: number;
  workMinutes: number;
  lat: number | null;
  lng: number | null;
  selfieImage?: string | null;
  inOffice?: boolean;
}

export interface IAttendance extends Document {
  employeeId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD IST
  dayStatus: 'Early' | 'On Time' | 'Late' | 'Absent';
  sessions: ISession[];
  totalWorkMins: number;
  totalBreakMins: number;
  lateByMins: number;
  earlyByMins: number;
  isCheckedIn: boolean;
  isOnBreak: boolean;
  isInField: boolean;
  workMode: 'Present' | 'Break' | 'Field' | 'WFH' | 'Absent';
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>({
  checkIn:     { type: Date, required: true },
  checkOut:    { type: Date, default: null },
  type:        { type: String, enum: ['work', 'break', 'field'], default: 'work' },
  minutes:     { type: Number, default: 0 },
  workMinutes: { type: Number, default: 0 },
  lat:         { type: Number, default: null },
  lng:         { type: Number, default: null },
  selfieImage: { type: String, default: null },
  inOffice:    { type: Boolean, default: false },
}, { _id: false, strict: false });

const AttendanceSchema = new Schema<IAttendance>({
  employeeId:    { type: Schema.Types.ObjectId, ref: 'GpAttUser', required: true },
  date:          { type: String, required: true },
  dayStatus:     { type: String, enum: ['Early', 'On Time', 'Late', 'Absent'], default: 'Absent' },
  sessions:      { type: [SessionSchema], default: [] },
  totalWorkMins: { type: Number, default: 0 },
  totalBreakMins:{ type: Number, default: 0 },
  lateByMins:    { type: Number, default: 0 },
  earlyByMins:   { type: Number, default: 0 },
  isCheckedIn:   { type: Boolean, default: false },
  isOnBreak:     { type: Boolean, default: false },
  isInField:     { type: Boolean, default: false },
  workMode:      { type: String, enum: ['Present', 'Break', 'Field', 'WFH', 'Absent'], default: 'Absent' },
}, { timestamps: true });

AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1 });

export default mongoose.models.GpAttendance || mongoose.model<IAttendance>('GpAttendance', AttendanceSchema);
