import { Employee } from "../models/index.js";

/**
 * Audit log helper that prints to console with standard JSON structure,
 * making sure not to expose passwords/hashes, while keeping tracked records readable.
 */
export function logSecurityAudit(req, action, details = {}) {
  const userId = req?.user?.id || "unauthenticated";
  const email = req?.user?.email || "unknown";
  const role = req?.user?.role || "none";
  const path = req?.originalUrl || req?.url || "unknown";
  const method = req?.method || "unknown";

  console.warn(JSON.stringify({
    event: "SECURITY_AUDIT",
    timestamp: new Date().toISOString(),
    userId,
    email,
    role,
    method,
    path,
    action,
    details,
  }));
}

export function isAdmin(user) {
  return user?.role === "admin";
}

export function isHR(user) {
  return user?.role === "hr";
}

export function isManager(user) {
  return user?.role === "manager";
}

/**
 * Returns a Set of all employee IDs in the direct + indirect reporting hierarchy of the manager.
 */
export async function getManagerHierarchyIds(managerEmployeeId) {
  if (!managerEmployeeId) return new Set();

  const allEmployees = await Employee.find({}).lean();
  const visible = new Set();
  const queue = [managerEmployeeId];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const e of allEmployees) {
      if (e.managerId === current && !visible.has(e.id)) {
        visible.add(e.id);
        queue.push(e.id);
      }
    }
  }

  return visible;
}

/**
 * Check if the user is allowed to manage a specific employee.
 * Admins, HR can manage anyone.
 * Managers can only manage their reporting tree.
 */
export async function canManageEmployee(user, employeeId) {
  if (!user) return false;
  if (isAdmin(user) || isHR(user)) return true;

  if (isManager(user) && user.employeeId) {
    if (user.employeeId === employeeId) return true;
    const reportIds = await getManagerHierarchyIds(user.employeeId);
    return reportIds.has(employeeId);
  }

  return user.employeeId === employeeId;
}

/**
 * Standard utility for checking resource access limits or scopes.
 * If user owns the record, returns true.
 * If user is manager and employeeId is one of their reports, returns true.
 */
export async function canAccessEmployeeResource(user, employeeId) {
  if (!user) return false;
  if (isAdmin(user) || isHR(user)) return true;

  if (user.employeeId && user.employeeId === employeeId) {
    return true;
  }

  if (isManager(user) && user.employeeId) {
    const reportIds = await getManagerHierarchyIds(user.employeeId);
    return reportIds.has(employeeId);
  }

  return false;
}
