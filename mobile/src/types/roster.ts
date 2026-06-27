// src/types/roster.ts

/** Types related to employee roster and attendance events */
export interface AttendanceEvent {
  employeeId: string;
  timestamp: number; // Unix epoch ms
  type: "clock-in" | "clock-out";
}

export interface RosterEntry {
  id: string;
  name: string;
  role: string;
  zone?: string;
  shiftStatus?: "on" | "off" | "break";
}
