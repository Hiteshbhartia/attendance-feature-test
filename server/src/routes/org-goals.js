import express from "express";
import { Employee } from "../models/index.js";
import { asyncHandler } from "../lib/async-handler.js";

const router = express.Router();

/**
 * GET /api/org-goals
 * Fetches all employees and returns their metrics directly from the DB.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    // In a fully-realized version, this would perform a massive aggregate
    // across Tasks, Attendance, and Kudos collections.
    // Since the database already has seeded `profile` fields, we use those.
    // Exclude Admin users from the Org Goals table
    const employees = await Employee.find({ role: { $ne: "Admin" } }).lean();

    const results = employees.map((emp) => {
      // Create a stable random variation based on the employee ID
      const seed = Array.from(emp.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const mod1 = (seed % 15) - 5; // -5 to +9
      const mod2 = (seed % 20) - 10; // -10 to +9
      const mod3 = (seed % 25) - 12; // -12 to +12

      // Calculate scores similar to the frontend's computeScore
      const attendance = emp.profile?.attendance ?? 0;
      const tasks = emp.profile?.taskCompletion ?? 0;
      const roleKpi = emp.profile?.performance ?? emp.profile?.roleKpi ?? 0;

      // Ensure valid total computation
      const total = Math.round((attendance + tasks) / 2);
      
      let tier = "D";
      if (total >= 95) tier = "A";
      else if (total >= 85) tier = "B";
      else if (total >= 70) tier = "C";

      // Flags simulation based on scores
      const flags = [];
      if (attendance < 75) flags.push("Low Attendance");
      if (tasks < 70) flags.push("Tasks Failing");
      if (roleKpi < 70) flags.push("KPI Warning");

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        team: emp.team || "Operations",
        appRole: emp.appRole || "employee",
        avatarColor: emp.avatarColor,
        metrics: {
          attendance,
          tasks,
          roleKpi,
          total,
          tier,
          flags
        }
      };
    });

    res.json(results);
  })
);

export default router;
