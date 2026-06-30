import { api } from "@/lib/api-client";

export interface RolePermission {
  role: string;
  feature: string;
  enabled: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export async function getPermissions(role?: string): Promise<RolePermission[]> {
  try {
    const params = role ? new URLSearchParams({ role }).toString() : "";
    const url = `/permissions${params ? "?" + params : ""}`;
    const res = await api.get(url);
    return res as RolePermission[];
  } catch (err) {
    console.error("Failed to fetch permissions", err);
    return [];
  }
}

export async function updatePermission(
  role: string,
  feature: string,
  enabled: boolean
): Promise<RolePermission | null> {
  try {
    const res = await api.patch(`/permissions/${role}`, { feature, enabled });
    return res as RolePermission;
  } catch (err) {
    console.error("Failed to update permission", err);
    throw err;
  }
}
