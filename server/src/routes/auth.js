import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { User, Employee, Notification } from "../models/index.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import { asyncHandler } from "../lib/async-handler.js";
import { normalizeEmail, toHttpError, logAuth } from "../lib/errors.js";

const router = Router();
const BCRYPT_ROUNDS = 12;

const emailField = z
  .string()
  .email()
  .max(255)
  .transform((v) => normalizeEmail(v));

const SignupSchema = z.object({
  email: emailField,
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  employeeId: z.string().min(1).max(50).optional(),
});

const LoginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(128),
});

async function hashPassword(plain) {
  try {
    return await bcrypt.hash(plain, BCRYPT_ROUNDS);
  } catch (err) {
    logAuth("hashPassword.failed", {}, err);
    const e = new Error("Could not process password");
    e.status = 500;
    throw e;
  }
}

async function verifyPassword(plain, passwordHash) {
  if (!passwordHash) return false;
  try {
    return await bcrypt.compare(plain, passwordHash);
  } catch (err) {
    logAuth("verifyPassword.failed", {}, err);
    const e = new Error("Could not verify password");
    e.status = 500;
    throw e;
  }
}

async function maybeCreateEmployeeStub({ employeeId, name }) {
  if (!employeeId) return;
  try {
    const emp = await Employee.findOne({ id: employeeId });
    if (!emp) {
      await Employee.create({
        id: employeeId,
        name,
        role: "Operator",
      });
    }
  } catch (err) {
    // User account already exists; employee directory stub is optional.
    logAuth("signup.employee_stub_skipped", { employeeId }, err);
  }
}

router.post(
  "/signup",
  validate(SignupSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name, employeeId } = req.body;

    try {
      const existing = await User.findOne({ email });
      if (existing) {
        logAuth("signup.duplicate", { email });
        return res.status(409).json({ error: "Email already registered" });
      }

      const userCount = await User.countDocuments();
      const isFirst = userCount === 0;

      const passwordHash = await hashPassword(password);
      const user = await User.create({
        email,
        passwordHash,
        employeeId,
        role: isFirst ? "admin" : "employee",
        isApproved: isFirst,
        status: isFirst ? "active" : "pending",
        name,
      });

      await maybeCreateEmployeeStub({ employeeId, name });

      if (!isFirst) {
        logAuth("signup.pending_approval", { email, userId: String(user._id) });

        const admins = await User.find({ role: "admin" }).lean();
        if (admins.length > 0) {
          const notifications = admins.map((admin) => ({
            id: crypto.randomUUID(),
            kind: "approval",
            toId: admin.employeeId || String(admin._id),
            title: "New Account Request",
            body: `${name || email} has requested an account.`,
            actionLabel: "Review",
            actionTo: "/admin/workforce",
            ts: Date.now(),
            read: false,
          }));
          await Notification.insertMany(notifications);
          
          const { sendPushNotification } = await import("../lib/fcm.js");
          for (const notif of notifications) {
            await sendPushNotification(notif.toId, notif.title, notif.body);
          }
        }

        const token = signToken(user);
        return res.status(201).json({
          message: "Account created. Awaiting admin approval before you can sign in.",
          token,
          user: publicUser(user),
        });
      }

      const token = signToken(user);
      logAuth("signup.admin_bootstrapped", { email, userId: String(user._id) });
      return res.status(201).json({ token, user: publicUser(user) });
    } catch (err) {
      logAuth("signup.error", { email }, err);
      throw toHttpError(err);
    }
  }),
);

router.post(
  "/login",
  validate(LoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        logAuth("login.failed", { email, reason: "unknown_email" });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        logAuth("login.failed", { email, reason: "bad_password" });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const derivedStatus =
        user.isApproved && (!user.status || user.status === "pending")
          ? "active"
          : user.status || "pending";
      if (derivedStatus === "rejected") {
        logAuth("login.blocked", { email, reason: "rejected" });
        return res.status(403).json({ error: "Account request rejected" });
      }

      if (user.isSuspended || derivedStatus === "suspended") {
        logAuth("login.blocked", { email, reason: "suspended" });
        return res.status(403).json({ error: "Account suspended" });
      }

      const token = signToken(user);
      logAuth("login.success", { email, userId: String(user._id) });
      return res.json({ token, user: publicUser(user) });
    } catch (err) {
      logAuth("login.error", { email }, err);
      throw toHttpError(err);
    }
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "Not found" });
      }
      return res.json({ user: publicUser(user) });
    } catch (err) {
      logAuth("me.error", { userId: req.user?.id }, err);
      throw toHttpError(err);
    }
  }),
);

router.post(
  "/approve/:userId",
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin only" });
      }
      const u = await User.findByIdAndUpdate(
        req.params.userId,
        { isApproved: true },
        { new: true },
      );
      if (!u) {
        return res.status(404).json({ error: "User not found" });
      }
      logAuth("approve.success", { userId: String(u._id), by: req.user.id });
      return res.json({ user: publicUser(u) });
    } catch (err) {
      logAuth("approve.error", { userId: req.params.userId }, err);
      throw toHttpError(err);
    }
  }),
);

const ImpersonateSchema = z.object({
  employeeId: z.string().min(1),
});

router.post(
  "/impersonate",
  requireAuth,
  validate(ImpersonateSchema),
  asyncHandler(async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can impersonate users" });
      }

      const { employeeId } = req.body;
      
      const emp = await Employee.findOne({ id: employeeId });
      if (!emp) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Check if a registered User exists for this employee
      let user = await User.findOne({ employeeId });
      
      if (!user) {
        // Construct a dynamic stub user for impersonation
        user = {
          id: employeeId, // Fallback ID
          email: emp.email || `${employeeId}@gharpayy.com`,
          employeeId: emp.id,
          role: emp.appRole || "employee",
          isApproved: true,
          status: "active",
        };
      }

      const token = signToken(user);
      logAuth("impersonate.success", { adminId: req.user.id, targetEmployeeId: employeeId });
      return res.json({ token, user: publicUser(user) });
    } catch (err) {
      logAuth("impersonate.error", { adminId: req.user?.id, body: req.body }, err);
      throw toHttpError(err);
    }
  }),
);

const ChangePasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

router.post(
  "/change-password",
  requireAuth,
  validate(ChangePasswordSchema),
  asyncHandler(async (req, res) => {
    const { newPassword } = req.body;
    try {
      const u = await User.findById(req.user.id);
      if (!u) {
        return res.status(404).json({ error: "User not found" });
      }

      u.passwordHash = await hashPassword(newPassword);
      u.mustChangePassword = false;
      await u.save();

      logAuth("change-password.success", { userId: String(u._id) });
      return res.json({ user: publicUser(u) });
    } catch (err) {
      logAuth("change-password.error", { userId: req.user?.id }, err);
      throw toHttpError(err);
    }
  }),
);

function publicUser(u) {
  const status =
    u.isApproved && (!u.status || u.status === "pending") ? "active" : u.status || "pending";
  return {
    id: String(u._id || u.id),
    email: u.email,
    employeeId: u.employeeId ?? undefined,
    role: u.role,
    isApproved: u.isApproved,
    isSuspended: Boolean(u.isSuspended),
    mustChangePassword: Boolean(u.mustChangePassword),
    status,
  };
}

export default router;
