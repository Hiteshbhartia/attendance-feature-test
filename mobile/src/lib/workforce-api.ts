import { api } from "@/lib/api-client";
import type { ApiUser } from "@/lib/api-client";
import type { AppRole, Role } from "@/types/hr";

export type WorkforceAccountStatus = "active" | "suspended" | "pending" | "no_account";
export type WorkforceApprovalStatus = "approved" | "pending" | "none";

export type WorkforceRow = {
  employeeId: string;
  name: string;
  operationalRole: Role;
  appRole: AppRole;
  team: string;
  zone: string;
  managerId: string | null;
  managerName: string | null;
  experience: "New" | "Mid" | "Core";
  shift: string;
  email: string | null;
  user: ApiUser | null;
  accountStatus: WorkforceAccountStatus;
  approvalStatus: WorkforceApprovalStatus;
};

export type WorkforceListResponse = {
  items: WorkforceRow[];
  meta: { total: number; pendingCount: number };
};

export const OPERATIONAL_ROLES: Role[] = [
  "Admin",
  "Zone Leader",
  "Floor Lead",
  "Operator",
  "Flow Ops",
  "TCM",
  "HR",
  "Owner",
  "Coach",
  "Recruiter",
  "Property Partner",
];

export async function fetchWorkforce(): Promise<WorkforceListResponse> {
  return api.get<WorkforceListResponse>("/admin/workforce");
}

export async function inviteEmployee(input: {
  name: string;
  email: string;
  operationalRole: Role;
  appRole: AppRole;
  team: string;
  zone: string;
  managerId?: string | null;
  experience?: "New" | "Mid" | "Core";
  shift?: string;
}) {
  return api.post<{ item: WorkforceRow; temporaryPassword: string }>(
    "/admin/workforce/invite",
    input,
  );
}

export async function patchEmployeeOrg(
  employeeId: string,
  patch: Partial<{
    name: string;
    operationalRole: Role;
    appRole: AppRole;
    team: string;
    zone: string;
    managerId: string | null;
    experience: "New" | "Mid" | "Core";
    shift: string;
  }>,
) {
  return api.patch<{ item: WorkforceRow }>(`/admin/workforce/employees/${employeeId}`, patch);
}

export async function approveUser(
  userId: string,
  data: {
    operationalRole: Role;
    appRole: AppRole;
    team: string;
    zone: string;
    managerId: string | null;
    experience: "New" | "Mid" | "Core";
    shift: string;
  },
) {
  return api.patch<{ user: ApiUser; item?: WorkforceRow }>(
    `/admin/workforce/users/${userId}/approve`,
    data,
  );
}

export async function rejectUser(userId: string) {
  return api.patch<{ user: ApiUser; item?: WorkforceRow }>(
    `/admin/workforce/users/${userId}/reject`,
  );
}

export async function suspendUser(userId: string) {
  return api.patch<{ user: ApiUser; item?: WorkforceRow }>(
    `/admin/workforce/users/${userId}/suspend`,
  );
}

export async function reactivateUser(userId: string) {
  return api.patch<{ user: ApiUser; item?: WorkforceRow }>(
    `/admin/workforce/users/${userId}/reactivate`,
  );
}

export async function resetUserPassword(userId: string, newPassword: string) {
  return api.post<{ temporaryPassword: string; newPassword: string }>(
    `/admin/workforce/users/${userId}/reset-password`,
    { newPassword },
  );
}

export async function patchUserAccess(userId: string, appRole: AppRole) {
  return api.patch<{ user: ApiUser; item?: WorkforceRow }>(
    `/admin/workforce/users/${userId}/access`,
    { appRole },
  );
}
