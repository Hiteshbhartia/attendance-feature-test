import bcrypt from "bcryptjs";
import { User, Employee } from "../models/index.js";
import { normalizeEmail } from "./errors.js";

const BCRYPT_ROUNDS = 12;

/** Stable IDs — do not collide with demo seed e1–e30. */
export const TEST_MANAGER_EMPLOYEE_ID = "e-test-mgr";
export const TEST_EMPLOYEE_EMPLOYEE_ID = "e-test-emp";

const TEST_ACCOUNTS = [
  {
    email: "manager@gharpayy.com",
    password: "Manager@123",
    authRole: "manager",
    employeeId: TEST_MANAGER_EMPLOYEE_ID,
    employee: {
      id: TEST_MANAGER_EMPLOYEE_ID,
      name: "Test Manager",
      role: "Floor Lead",
      title: "Operations Manager",
      team: "Core Operations",
      zone: "HQ",
      performance: 84,
      appRole: "manager",
    },
  },
  {
    email: "employee@gharpayy.com",
    password: "Employee@123",
    authRole: "employee",
    employeeId: TEST_EMPLOYEE_EMPLOYEE_ID,
    employee: {
      id: TEST_EMPLOYEE_EMPLOYEE_ID,
      name: "Test Employee",
      role: "Operator",
      title: "Field Executive",
      team: "Core Operations",
      zone: "Bangalore",
      performance: 72,
      appRole: "employee",
    },
  },
];

function buildProfile(emp) {
  const perf = emp.performance;
  return {
    id: emp.id,
    name: emp.name,
    role: emp.role,
    appRole: emp.appRole,
    experience: "Mid",
    attendance: Math.min(100, perf + 6),
    performance: perf,
    consistency: Math.max(40, perf - 8),
    revenueImpact: emp.appRole === "manager" ? 120000 : 95000,
    taskCompletion: Math.min(100, perf + 4),
    conversion: emp.appRole === "manager" ? 18 : 14,
    callsToday: emp.appRole === "manager" ? 12 : 20,
    callTarget: 30,
    leadsActive: emp.appRole === "manager" ? 6 : 10,
    closedDeals: emp.appRole === "manager" ? 2 : 1,
    lostDeals: 1,
    flags: [],
    status: "Active",
    streakDays: emp.appRole === "manager" ? 5 : 2,
    team: emp.team,
    shift: "10:00 - 19:00",
    avatarSeed: emp.name.split(" ")[0],
    zone: emp.zone,
    managerId: emp.appRole === "employee" ? TEST_MANAGER_EMPLOYEE_ID : null,
    bio: `${emp.title} — role-based test account.`,
    joinedYearsAgo: 1,
  };
}

function employeeDoc(emp) {
  const profile = buildProfile(emp);
  return {
    id: emp.id,
    name: emp.name,
    role: emp.role,
    title: emp.title,
    hubId: emp.team,
    email: emp.email,
    profile,
  };
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Idempotent seed for manager + employee test auth users and employee profiles.
 * Never overwrites existing users or employees (email / id already present → skip).
 */
export async function seedTestAccounts() {
  const summary = { users: [], employees: [] };

  for (const spec of TEST_ACCOUNTS) {
    const email = normalizeEmail(spec.email);
    const empDoc = employeeDoc({ ...spec.employee, email });

    const empExisting = await Employee.findOne({ id: spec.employeeId });
    if (empExisting) {
      summary.employees.push({ id: spec.employeeId, status: "skipped", reason: "exists" });
    } else {
      await Employee.create(empDoc);
      summary.employees.push({ id: spec.employeeId, status: "created" });
    }

    const userExisting = await User.findOne({ email });
    if (userExisting) {
      summary.users.push({ email, status: "skipped", reason: "exists" });
      continue;
    }

    const passwordHash = await hashPassword(spec.password);
    await User.create({
      email,
      passwordHash,
      employeeId: spec.employeeId,
      role: spec.authRole,
      isApproved: true,
    });
    summary.users.push({ email, status: "created", role: spec.authRole });
  }

  return { ok: true, summary };
}
