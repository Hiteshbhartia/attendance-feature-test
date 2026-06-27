import { Router } from "express";
import { AttendanceEvent, Employee } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../lib/async-handler.js";
import { crudRouter } from "../lib/crud.js";
import {
  isAdmin,
  isHR,
  isManager,
  getManagerHierarchyIds,
} from "../lib/auth-helpers.js";

const router = Router();

/**
 * GET /api/attendance-events/by-date?date=YYYY-MM-DD
 *
 * Returns all AttendanceEvent documents for the given calendar date.
 * Access:
 *   admin / hr  → all employees
 *   manager     → employees within their reporting hierarchy
 *   employee    → 403
 *
 * The date is matched by converting the day boundaries to epoch-ms timestamps
 * and querying the indexed `ts` field — no new model, no schema change.
 */
router.get(
  "/by-date",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Employees cannot access the roster view
    if (!isAdmin(req.user) && !isHR(req.user) && !isManager(req.user)) {
      return res.status(403).json({ error: "Forbidden: roster access requires admin, HR, or manager role" });
    }

    const dateParam = req.query.date;
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return res.status(400).json({ error: "date query param required (YYYY-MM-DD)" });
    }

    // Build epoch-ms range for the full calendar day in IST (UTC+5:30).
    //
    // `ts` is stored as Date.now() — a UTC epoch value — but the client's
    // dateKey() uses local JS date methods (getDate/getMonth/getFullYear),
    // which return the IST calendar date on Indian browsers.
    //
    // If we used UTC midnight boundaries here, any clock-in between
    // 00:00 IST and 05:29 IST would fall outside the UTC day window for
    // the date the employee actually sees on their screen.
    //
    // Fix: treat the incoming YYYY-MM-DD as an IST calendar date.
    // IST = UTC+5:30 = +19800 seconds offset.
    // IST midnight = UTC midnight minus 5h30m = UTC previous-day 18:30:00.
    //
    // Example: date=2026-06-16
    //   dayStart = 2026-06-15T18:30:00.000Z  (00:00:00 IST Jun 16)
    //   dayEnd   = 2026-06-16T18:29:59.999Z  (23:59:59 IST Jun 16)
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19800000 ms
    const dayStart = new Date(`${dateParam}T00:00:00.000Z`).getTime() - IST_OFFSET_MS;
    const dayEnd   = new Date(`${dateParam}T23:59:59.999Z`).getTime() - IST_OFFSET_MS;

    // Determine which employee IDs this user may see
    let employeeIdFilter = null; // null = no restriction (admin/hr)

    if (isManager(req.user) && !isAdmin(req.user) && !isHR(req.user)) {
      if (!req.user.employeeId) {
        return res.json({ items: [], date: dateParam });
      }
      const reportIds = await getManagerHierarchyIds(req.user.employeeId);
      // Include the manager themselves
      reportIds.add(req.user.employeeId);
      employeeIdFilter = Array.from(reportIds);
    }

    const query = {
      ts: { $gte: dayStart, $lte: dayEnd },
    };
    if (employeeIdFilter !== null) {
      query.employeeId = { $in: employeeIdFilter };
    }

    const events = await AttendanceEvent.find(query).sort({ ts: 1 }).lean();

    // Attach employee name + role for display (avoids a second round-trip from the client)
    const empIds = [...new Set(events.map((e) => e.employeeId))];
    const employees = empIds.length
      ? await Employee.find({ id: { $in: empIds } }, { id: 1, name: 1, role: 1, hubId: 1, managerId: 1, profile: 1 }).lean()
      : [];

    const empMap = new Map(employees.map((e) => [e.id, e]));

    const items = events.map((ev) => {
      const emp = empMap.get(ev.employeeId);
      return {
        id: ev.id,
        employeeId: ev.employeeId,
        employeeName: emp?.name ?? ev.employeeId,
        employeeRole: emp?.role ?? "—",
        employeeTeam: emp?.profile?.team ?? emp?.hubId ?? "HQ",
        kind: ev.kind,
        ts: ev.ts,
        lat: ev.lat ?? null,
        lng: ev.lng ?? null,
        accuracy: ev.accuracy ?? null,
        address: ev.address ?? null,
        selfie: ev.selfie ?? null,
      };
    });

    return res.json({ items, date: dateParam });
  }),
);

// Mount the standard CRUD routes (list, get, create, patch, delete, bulk-upsert)
// AFTER the named route so /by-date is matched first.
router.use(
  "/",
  crudRouter(AttendanceEvent, {
    filterFields: ["employeeId", "kind"],
    sort: { ts: -1 },
  }),
);

export default router;
