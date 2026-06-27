import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, Employee } from "../models/index.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import { asyncHandler } from "../lib/async-handler.js";
import { normalizeEmail, toHttpError } from "../lib/errors.js";
import {
  OPERATIONAL_ROLES,
  APP_ROLES,
  accountStatus,
  assertCanDemoteAdmin,
  assertCanSuspendAdmin,
  assertNotSelf,
  authRoleFromAppAccess,
  employeeOrgFields,
  generateTempPassword,
  mergeEmployeeProfile,
  newEmployeeId,
  publicAuthUser,
  readProfile,
} from "../lib/workforce-access.js";

const router = Router();
const BCRYPT_ROUNDS = 12;
const adminOnly = [requireAuth, requireRole("admin")];

router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user.role === "admin") return next();
  if (req.method === "PATCH" && req.path.match(/^\/employees\/[^\/]+$/)) {
    return next();
  }
  return res.status(403).json({ error: "Admin access required" });
});

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function buildWorkforceRows() {
  const [employees, users] = await Promise.all([
    Employee.find({}).sort({ name: 1 }).lean(),
    User.find({}).lean(),
  ]);

  const userByEmployeeId = new Map();
  const userById = new Map();
  for (const u of users) {
    userById.set(String(u._id), u);
    if (u.employeeId) userByEmployeeId.set(String(u.employeeId), u);
  }

  const nameById = new Map(employees.map((e) => [e.id, e.name]));

  const rows = employees.map((emp) => {
    const user = userByEmployeeId.get(emp.id) ?? null;
    const org = employeeOrgFields(emp);
    const managerName = org.managerId ? (nameById.get(org.managerId) ?? null) : null;

    return {
      employeeId: emp.id,
      ...org,
      managerName,
      user: publicAuthUser(user),
      accountStatus: accountStatus(user),
      approvalStatus: user ? (user.isApproved ? "approved" : "pending") : "none",
    };
  });

  // Find users who don't have a linked Employee record yet (pending or approved admins/hr)
  for (const u of users) {
    const derivedStatus = accountStatus(u);
    const isLinked = u.employeeId && nameById.has(u.employeeId);
    if (!isLinked) {
      rows.push({
        employeeId: u.employeeId || String(u._id),
        name: u.name || u.email.split("@")[0],
        operationalRole: u.role === "admin" ? "Admin" : u.role === "hr" ? "HR" : "Operator",
        appRole: u.role || "employee",
        team: "HQ",
        zone: "All",
        managerId: null,
        managerName: null,
        experience: "Core",
        shift: "9:00 AM - 6:00 PM",
        email: u.email,
        user: publicAuthUser(u),
        accountStatus: derivedStatus,
        approvalStatus: u.isApproved ? "approved" : "pending",
      });
    }
  }

  return rows;
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await buildWorkforceRows();
    const pendingCount = items.filter((r) => r.approvalStatus === "pending").length;
    return res.json({ items, meta: { total: items.length, pendingCount } });
  }),
);

const InviteSchema = z.object({
  name: z.string().min(1).max(120),
  email: z
    .string()
    .email()
    .max(255)
    .transform((v) => normalizeEmail(v)),
  operationalRole: z.enum(OPERATIONAL_ROLES),
  appRole: z.enum(APP_ROLES),
  team: z.string().min(1).max(120),
  zone: z.string().min(1).max(120),
  managerId: z.string().max(50).nullable().optional(),
  employeeId: z.string().min(1).max(50).optional(),
  experience: z.enum(["New", "Mid", "Core"]).optional(),
  shift: z.string().max(80).optional(),
});

router.post(
  "/invite",
  validate(InviteSchema),
  asyncHandler(async (req, res) => {
    const {
      name,
      email,
      operationalRole,
      appRole,
      team,
      zone,
      managerId,
      employeeId: requestedId,
      experience = "Mid",
      shift = "10:00 - 19:00",
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const employeeId = requestedId ?? newEmployeeId();
    let emp = await Employee.findOne({ id: employeeId });
    if (!emp) {
      const profile = {
        id: employeeId,
        name,
        role: operationalRole,
        appRole,
        experience,
        shift,
        team,
        zone,
        managerId: managerId ?? null,
        attendance: 85,
        performance: 70,
        consistency: 70,
        revenueImpact: 0,
        taskCompletion: 75,
        conversion: 15,
        callsToday: 0,
        callTarget: 30,
        leadsActive: 0,
        closedDeals: 0,
        lostDeals: 0,
        flags: [],
        status: "Active",
        streakDays: 0,
        avatarSeed: name.split(" ")[0] ?? employeeId,
      };
      emp = await Employee.create({
        id: employeeId,
        name,
        role: operationalRole,
        title: operationalRole,
        managerId: managerId ?? undefined,
        hubId: team,
        email,
        profile,
      });
    } else {
      mergeEmployeeProfile(emp, {
        name,
        operationalRole,
        appRole,
        team,
        zone,
        managerId,
        experience,
        shift,
      });
      emp.email = email;
      await emp.save();
    }

    const isDev = process.env.NODE_ENV !== "production";
    const temporaryPassword = isDev ? "Demo@123" : generateTempPassword();
    const passwordHash = isDev
      ? await bcrypt.hash("Demo@123", 12)
      : await hashPassword(temporaryPassword);

    if (isDev) {
      console.log(`[DEV-AUTH] Invited user email: ${email}`);
      console.log(`[DEV-AUTH] Password initialized successfully`);
      // Log removed for security
    }
    const user = await User.create({
      email,
      passwordHash,
      employeeId,
      role: authRoleFromAppAccess(appRole, operationalRole),
      isApproved: true,
      isSuspended: false,
      mustChangePassword: true,
    });

    const row = (await buildWorkforceRows()).find((r) => r.employeeId === employeeId);
    return res.status(201).json({
      item: row,
      temporaryPassword,
      user: publicAuthUser(user),
    });
  }),
);

const PatchEmployeeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  operationalRole: z.enum(OPERATIONAL_ROLES).optional(),
  appRole: z.enum(APP_ROLES).optional(),
  team: z.string().min(1).max(120).optional(),
  zone: z.string().min(1).max(120).optional(),
  managerId: z.string().max(50).nullable().optional(),
  experience: z.enum(["New", "Mid", "Core"]).optional(),
  shift: z.string().max(80).optional(),
  birthday: z.string().max(20).optional(),
  avatarSeed: z.string().optional(),
});

router.patch(
  "/employees/:employeeId",
  validate(PatchEmployeeSchema),
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin" && req.user.employeeId !== req.params.employeeId) {
      return res.status(403).json({ error: "Forbidden: You can only edit your own profile" });
    }
    if (req.user.role !== "admin") {
      delete req.body.operationalRole;
      delete req.body.appRole;
      delete req.body.team;
      delete req.body.zone;
      delete req.body.managerId;
      delete req.body.shift;
      delete req.body.experience;
    }

    const emp = await Employee.findOne({ id: req.params.employeeId });
    if (!emp) return res.status(404).json({ error: "Employee not found" });

    if (req.body.managerId && req.body.managerId === emp.id) {
      return res.status(400).json({ error: "Employee cannot be their own manager" });
    }

    mergeEmployeeProfile(emp, req.body);
    await emp.save();

    const linked = await User.findOne({ employeeId: emp.id });
    if (linked && req.body.appRole) {
      const nextRole = authRoleFromAppAccess(req.body.appRole, emp.role);
      if (linked.role === "admin" && nextRole !== "admin") {
        await assertCanDemoteAdmin(linked);
      }
      linked.role = nextRole;
      await linked.save();
    }

    const row = (await buildWorkforceRows()).find((r) => r.employeeId === emp.id);
    return res.json({ item: row });
  }),
);

const ApproveSchema = z.object({
  operationalRole: z.enum(OPERATIONAL_ROLES),
  appRole: z.enum(APP_ROLES),
  team: z.string().min(1),
  zone: z.string().min(1),
  managerId: z.string().nullable().optional(),
  experience: z.enum(["New", "Mid", "Core"]),
  shift: z.string().min(1),
});

router.patch(
  "/users/:userId/approve",
  validate(ApproveSchema),
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.params.userId);
    if (!u) return res.status(404).json({ error: "User not found" });

    const topLevel = ["Admin", "Zone Leader", "Owner", "HR"];
    if (!topLevel.includes(req.body.operationalRole) && !req.body.managerId) {
      return res.status(400).json({ error: "Reporting manager is required for this role" });
    }

    let emp = await Employee.findOne({ id: u.employeeId });
    if (!emp) {
      const empId =
        u.employeeId && !u.employeeId.startsWith("pending_") ? u.employeeId : newEmployeeId();
      emp = await Employee.create({
        id: empId,
        name: u.name || u.email.split("@")[0],
        role: req.body.operationalRole,
        email: u.email,
      });
      u.employeeId = empId;
      await u.save();
    }

    mergeEmployeeProfile(emp, req.body);
    await emp.save();

    u.isApproved = true;
    u.isSuspended = false;
    u.status = "active";
    u.role = authRoleFromAppAccess(req.body.appRole, req.body.operationalRole);
    await u.save();

    const row = (await buildWorkforceRows()).find((r) => r.user?.id === String(u._id));
    return res.json({ user: publicAuthUser(u), item: row });
  }),
);

router.patch(
  "/users/:userId/reject",
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.params.userId);
    if (!u) return res.status(404).json({ error: "User not found" });
    assertNotSelf(req.user.id, u._id, "reject");

    u.isApproved = false;
    u.status = "rejected";
    await u.save();
    const row = (await buildWorkforceRows()).find((r) => r.user?.id === String(u._id));
    return res.json({ user: publicAuthUser(u), item: row });
  }),
);

router.patch(
  "/users/:userId/suspend",
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.params.userId);
    if (!u) return res.status(404).json({ error: "User not found" });
    assertNotSelf(req.user.id, u._id, "suspend");
    await assertCanSuspendAdmin(u);

    u.isSuspended = true;
    u.status = "suspended";
    await u.save();
    const row = (await buildWorkforceRows()).find((r) => r.user?.id === String(u._id));
    return res.json({ user: publicAuthUser(u), item: row });
  }),
);

router.patch(
  "/users/:userId/reactivate",
  asyncHandler(async (req, res) => {
    const u = await User.findByIdAndUpdate(
      req.params.userId,
      { isSuspended: false, isApproved: true, status: "active" },
      { new: true },
    );
    if (!u) return res.status(404).json({ error: "User not found" });
    const row = (await buildWorkforceRows()).find((r) => r.user?.id === String(u._id));
    return res.json({ user: publicAuthUser(u), item: row });
  }),
);

const AccessSchema = z.object({
  appRole: z.enum(APP_ROLES),
});

router.patch(
  "/users/:userId/access",
  validate(AccessSchema),
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.params.userId);
    if (!u) return res.status(404).json({ error: "User not found" });

    const emp = u.employeeId ? await Employee.findOne({ id: u.employeeId }) : null;
    const operationalRole = emp?.role ?? "";
    const nextRole = authRoleFromAppAccess(req.body.appRole, operationalRole);

    if (u.role === "admin" && nextRole !== "admin") {
      assertNotSelf(req.user.id, u._id, "demote");
      await assertCanDemoteAdmin(u);
    }

    u.role = nextRole;
    await u.save();

    if (emp) {
      mergeEmployeeProfile(emp, { appRole: req.body.appRole });
      await emp.save();
    }

    const row = (await buildWorkforceRows()).find((r) => r.user?.id === String(u._id));
    return res.json({ user: publicAuthUser(u), item: row });
  }),
);

router.post(
  "/users/:userId/reset-password",
  asyncHandler(async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const u = await User.findById(req.params.userId);
    if (!u) return res.status(404).json({ error: "User not found" });

    u.passwordHash = await hashPassword(newPassword);
    u.mustChangePassword = newPassword === "Demo@123";
    await u.save();

    return res.json({
      user: publicAuthUser(u),
      newPassword,
    });
  }),
);

export default router;
