import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const passwordChangeSchema = z.object({
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const adminResetPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128).optional(),
}).refine((d) => !d.confirmPassword || d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const signupSchema = z.object({
  fullName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  dateOfBirth: z.string().optional(),
  jobRole: z.enum(['full-time', 'intern']).optional(),
  officeZoneId: z.string().optional(),
  profilePhoto: z.string().optional(),
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  breakDuration: z.union([z.number(), z.string()]).optional(),
});

export const noticeSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  message: z.string().min(1).max(2000).trim(),
  type: z.enum(['general', 'warning', 'urgent']).optional(),
  targetId: z.string().nullable().optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  assignedTo: z.string(),
  assignedToName: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  teamName: z.string().optional(),
  teamId: z.string().nullable().optional(),
});

export const correctionSchema = z.object({
  employeeId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export const exceptionSchema = z.object({
  type: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1).max(500),
  requestedTime: z.string().nullable().optional(),
});

export const orgUpdateSchema = z.object({
  employeeId: z.string(),
  managerId: z.string().nullable().optional(),
  teamName: z.string().max(100).optional(),
});
