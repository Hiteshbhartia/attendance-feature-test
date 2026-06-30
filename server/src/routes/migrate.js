import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../lib/async-handler.js";
import { seedTestAccounts } from "../lib/seed-test-accounts.js";
import { seedPlaybooks } from "../lib/seed-playbooks.js";
import {
  User,
  Employee,
  AttendanceEvent,
  Task,
  Leave,
  Kudo,
  CalEvent,
  ConsoleState,
  PulseEntry,
  FlyUpdate,
  FlyRetro,
  FlyFeed,
  Notification,
  OneOnOne,
  Candidate,
} from "../models/index.js";

const router = Router();

// COMPLETELY disable seed/migration endpoints in production to prevent 500 errors
// and accidental data overwrites. These are local/demo only.
router.use((req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";
  const enableSeeding = process.env.ENABLE_DEV_SEEDING === "true";

  if (isProduction || !enableSeeding) {
    import("../lib/auth-helpers.js").then(({ logSecurityAudit }) => {
      logSecurityAudit(req, "MIGRATE_ROUTE_BLOCKED", {
        reason: "Endpoint disabled in production or seeding not enabled",
      });
    });
    return res.status(403).json({
      error: "Seed routes disabled in production or restricted",
    });
  }

  // Force Admin role on all endpoints inside this migration route (unless in dev)
  if (req.user?.role !== "admin" && !(!isProduction && enableSeeding)) {
    import("../lib/auth-helpers.js").then(({ logSecurityAudit }) => {
      logSecurityAudit(req, "MIGRATE_ROUTE_FORBIDDEN", {
        reason: "Non-admin user attempted to call migration route",
      });
    });
    return res.status(403).json({ error: "Admin only" });
  }

  next();
});

const MODULE_MODELS = {
  tasks: Task,
  leaves: Leave,
  kudos: Kudo,
  calendar: CalEvent,
  attendanceEvents: AttendanceEvent,
  pulse: PulseEntry,
  flyUpdates: FlyUpdate,
  flyRetro: FlyRetro,
  flyFeed: FlyFeed,
  notifications: Notification,
  oneOnOnes: OneOnOne,
  recruiting: Candidate,
  consoleDays: ConsoleState,
};

function consoleDayToDoc(day, userId) {
  const id = `${day.actorId}:${day.date}`;
  return {
    id,
    actorId: day.actorId,
    date: day.date,
    createdById: userId,
    payload: {
      kpis: day.kpis ?? {},
      sprints: day.sprints ?? {},
      windowsSent: day.windowsSent ?? {},
      eod: day.eod ?? {},
      decisions: day.decisions ?? [],
    },
    kpis: day.kpis ?? {},
    sprintsDone: Object.entries(day.sprints ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k),
    sentWindows: Object.keys(day.windowsSent ?? {}),
    eodDraft: day.eod?.summary ?? "",
    hardDecisions: (day.decisions ?? []).map((d) => d.text).join("\n"),
  };
}

async function importIfEmpty(Model, items, transform) {
  const count = await Model.countDocuments();
  if (count > 0) {
    return { skipped: true, existing: count };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { skipped: true, reason: "no_items" };
  }
  let imported = 0;
  for (const raw of items) {
    const item = transform ? transform(raw) : raw;
    if (!item?.id) continue;
    await Model.updateOne({ id: item.id }, { $set: item }, { upsert: true });
    imported += 1;
  }
  return { imported };
}

/**
 * Safe one-way import: only writes when the target collection is empty.
 * Never deletes or overwrites existing Mongo data.
 */
router.post(
  "/bootstrap",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const userId = req.user.id;
    const results = {};

    for (const [key, Model] of Object.entries(MODULE_MODELS)) {
      const items = body[key];
      if (items === undefined) continue;

      if (key === "consoleDays") {
        results[key] = await importIfEmpty(Model, items, (day) => consoleDayToDoc(day, userId));
      } else {
        results[key] = await importIfEmpty(Model, items, (item) => ({
          ...item,
          createdById: item.createdById ?? userId,
        }));
      }
    }

    res.json({ ok: true, results });
  }),
);

/** Idempotent upsert — inserts new demo rows only; never overwrites existing records. */
async function upsertSeedMany(Model, items, transform) {
  if (!Array.isArray(items) || items.length === 0) {
    return { inserted: 0, skipped: 0, total: 0 };
  }
  let inserted = 0;
  let skipped = 0;
  for (const raw of items) {
    const doc = transform ? transform(raw) : raw;
    if (!doc?.id) continue;
    const r = await Model.updateOne({ id: doc.id }, { $setOnInsert: doc }, { upsert: true });
    if (r.upsertedCount > 0) inserted += 1;
    else skipped += 1;
  }
  return { inserted, skipped, total: items.length };
}

/**
 * Seed the full Gharpayy demo org into MongoDB (idempotent).
 * Accepts the same payload shape as frontend buildDemoPayload().
 */
router.post(
  "/seed-demo-data",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const userId = req.user.id;
    const results = {};

    if (body.employees) {
      results.employees = await upsertSeedMany(Employee, body.employees, (e) => ({
        ...e,
        createdById: userId,
      }));
    }
    if (body.tasks) {
      results.tasks = await upsertSeedMany(Task, body.tasks, (t) => ({
        ...t,
        createdById: t.createdById ?? userId,
      }));
    }
    if (body.leaves) {
      results.leaves = await upsertSeedMany(Leave, body.leaves);
    }
    if (body.kudos) {
      results.kudos = await upsertSeedMany(Kudo, body.kudos);
    }
    if (body.calendar) {
      results.calendar = await upsertSeedMany(CalEvent, body.calendar);
    }
    if (body.attendanceEvents) {
      results.attendanceEvents = await upsertSeedMany(AttendanceEvent, body.attendanceEvents);
    }
    if (body.pulse?.length) {
      results.pulse = await upsertSeedMany(PulseEntry, body.pulse);
    }
    if (body.flyUpdates) {
      results.flyUpdates = await upsertSeedMany(FlyUpdate, body.flyUpdates);
    }
    if (body.flyRetro) {
      results.flyRetro = await upsertSeedMany(FlyRetro, body.flyRetro);
    }
    if (body.flyFeed) {
      results.flyFeed = await upsertSeedMany(FlyFeed, body.flyFeed);
    }
    if (body.notifications) {
      results.notifications = await upsertSeedMany(Notification, body.notifications);
    }
    if (body.oneOnOnes) {
      results.oneOnOnes = await upsertSeedMany(OneOnOne, body.oneOnOnes);
    }
    if (body.recruiting) {
      results.recruiting = await upsertSeedMany(Candidate, body.recruiting);
    }
    if (body.consoleDays?.length) {
      results.consoleDays = await upsertSeedMany(ConsoleState, body.consoleDays, (day) =>
        consoleDayToDoc(day, userId),
      );
    }

    const counts = {};
    for (const [key, Model] of [
      ["employees", Employee],
      ["tasks", Task],
      ["leaves", Leave],
      ["kudos", Kudo],
      ["calendar", CalEvent],
      ["attendanceEvents", AttendanceEvent],
      ["pulse", PulseEntry],
      ["flyUpdates", FlyUpdate],
      ["flyRetro", FlyRetro],
      ["flyFeed", FlyFeed],
      ["notifications", Notification],
      ["oneOnOnes", OneOnOne],
      ["recruiting", Candidate],
    ]) {
      counts[key] = await Model.countDocuments();
    }

    res.json({ ok: true, results, counts });
  }),
);

/**
 * Idempotent test auth users (manager + employee) and matching employee profiles.
 * Skips any record that already exists — never overwrites admin or demo data.
 */
router.post(
  "/seed-test-accounts",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const result = await seedTestAccounts();
    const userCount = await User.countDocuments();
    const employeeCount = await Employee.countDocuments();
    res.json({ ...result, counts: { users: userCount, employees: employeeCount } });
  }),
);

/**
 * Seed all role playbooks into MongoDB.
 * Idempotent — safe to call multiple times.
 */
router.post(
  "/seed-playbooks",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const results = await seedPlaybooks();
    res.json({ ok: true, results });
  }),
);

export default router;
