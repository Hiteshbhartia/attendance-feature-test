import bcrypt from "bcryptjs";
import { User, Employee } from "../models/index.js";
import { normalizeEmail } from "./errors.js";

const BCRYPT_ROUNDS = 12;
export const DEMO_AUTH_PASSWORD = "Demo@123";

/**
 * Build firstname.lastname local part from display name (lowercase, dots, ASCII-safe).
 * Examples: "Rahul Sharma" → "rahul.sharma", "Priya Nair" → "priya.nair"
 */
export function demoEmailLocalFromName(name) {
  if (!name || typeof name !== "string") return null;
  const ascii = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s.-]/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (ascii.length === 0) return null;
  if (ascii.length === 1) {
    const one = ascii[0].replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
    return one.length > 0 ? one : null;
  }
  const first = ascii[0];
  const last = ascii.slice(1).join(".");
  const local = `${first}.${last}`.replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
  return local.length > 0 ? local : null;
}

/** Default demo email for an employee (may need suffix if duplicate). */
export function demoEmailFromName(name) {
  const local = demoEmailLocalFromName(name);
  if (!local) return null;
  return normalizeEmail(`${local}@gharpayy.com`);
}

function withEmployeeSuffix(local, employeeId) {
  const safeId = String(employeeId)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  return normalizeEmail(`${local}.${safeId}@gharpayy.com`);
}

function withNumericSuffix(local, employeeId, n) {
  const safeId = String(employeeId)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  return normalizeEmail(`${local}.${safeId}.${n}@gharpayy.com`);
}

/**
 * Map existing employee job / profile to User.role (JWT / auth enum).
 * Does not modify the employee document.
 */
export function authRoleFromEmployee(emp) {
  const profile = emp.profile && typeof emp.profile === "object" ? emp.profile : {};
  const appRole = profile.appRole;
  if (appRole === "admin") return "admin";
  if (appRole === "hr") return "hr";
  if (appRole === "manager") return "manager";
  if (appRole === "employee") return "employee";

  const job = String(emp.role || "").trim();
  if (/^admin$/i.test(job)) return "admin";
  if (/^hr$/i.test(job)) return "hr";
  if (
    /zone leader|floor lead|coach|recruiter|manager|flow ops|tcm|owner|property partner/i.test(job)
  ) {
    return "manager";
  }
  return "employee";
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Pick an email not used by another employee's user; reserves in `reserved` for this run.
 */
async function pickUniqueEmail(emp, reserved) {
  const local = demoEmailLocalFromName(emp.name);
  if (!local) return null;

  /** @type {Array<() => string>} */
  const candidates = [
    () => normalizeEmail(`${local}@gharpayy.com`),
    () => withEmployeeSuffix(local, emp.id),
  ];
  for (let n = 2; n <= 30; n += 1) {
    candidates.push(() => withNumericSuffix(local, emp.id, n));
  }

  for (const make of candidates) {
    const email = make();
    if (reserved.has(email)) continue;
    const u = await User.findOne({ email }).lean();
    if (!u) {
      reserved.add(email);
      return email;
    }
    if (String(u.employeeId || "") === String(emp.id)) {
      reserved.add(email);
      return email;
    }
  }

  return null;
}

/**
 * Idempotent bulk auth: one User per existing Employee, demo password, generated email.
 * Never updates Employee documents. Never overwrites existing user passwords or duplicates users.
 *
 * @param {{ dryRun?: boolean }} opts
 */
export async function runDemoAuthSeed(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const employees = await Employee.find({}).lean();
  const counts = {
    created: 0,
    skippedLinked: 0,
    skippedEmailExists: 0,
    skippedNoName: 0,
    wouldCreate: 0,
    errors: [],
  };

  const reservedEmails = new Set();
  const passwordHash = dryRun ? null : await hashPassword(DEMO_AUTH_PASSWORD);

  for (const emp of employees) {
    const id = emp.id;
    const name = emp.name;

    const existingByEmployee = await User.findOne({ employeeId: id }).lean();
    if (existingByEmployee) {
      console.log(
        `[seed] skipped existing user: ${existingByEmployee.email} linked employeeId: ${id}`,
      );
      counts.skippedLinked += 1;
      continue;
    }

    if (!demoEmailLocalFromName(name)) {
      console.log(`[seed] skipped no valid demo email for employeeId: ${id} name="${name}"`);
      counts.skippedNoName += 1;
      continue;
    }

    const email = await pickUniqueEmail(emp, reservedEmails);
    if (!email) {
      const msg = "could not allocate unique email";
      console.log(`[seed] error employeeId ${id}: ${msg}`);
      counts.errors.push({ employeeId: id, message: msg });
      continue;
    }

    const role = authRoleFromEmployee(emp);

    if (dryRun) {
      console.log(
        `[seed] dry-run would create user: ${email} role=${role} linked employeeId: ${id}`,
      );
      counts.wouldCreate += 1;
      continue;
    }

    try {
      await User.create({
        email,
        passwordHash,
        employeeId: id,
        role,
        isApproved: true,
      });
      console.log(`[seed] created user: ${email} role=${role} linked employeeId: ${id}`);
      counts.created += 1;
    } catch (err) {
      if (err?.code === 11000) {
        console.log(`[seed] skipped existing user (duplicate key): ${email}`);
        counts.skippedEmailExists += 1;
      } else {
        const message = err?.message || String(err);
        console.log(`[seed] error employeeId ${id}: ${message}`);
        counts.errors.push({ employeeId: id, message });
      }
    }
  }

  const summaryLine = dryRun
    ? `[seed] done — would create: ${counts.wouldCreate}, skipped (already linked): ${counts.skippedLinked}, skipped (no name): ${counts.skippedNoName}, skipped (duplicate): ${counts.skippedEmailExists}, errors: ${counts.errors.length}`
    : `[seed] done — created: ${counts.created}, skipped (already linked): ${counts.skippedLinked}, skipped (no name): ${counts.skippedNoName}, skipped (duplicate): ${counts.skippedEmailExists}, errors: ${counts.errors.length}`;

  console.log(summaryLine);
  return counts;
}
