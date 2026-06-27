import { Router } from "express";
import { RolePermission, AuditLog } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Get permissions (optionally filter by role)
router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.query.role !== req.user.role) {
      return res.status(403).json({ error: "Only admins can view permissions" });
    }
    const { role } = req.query;
    const query = role ? { role } : {};
    const permissions = await RolePermission.find(query);
    res.json(permissions);
  } catch (err) {
    next(err);
  }
});

// Update permission for a role/feature (Admin only)
router.patch("/:role", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can modify permissions" });
    }

    const { role } = req.params;
    const { feature, enabled } = req.body;
    
    if (!feature || typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Missing feature or enabled flag" });
    }

    const updated = await RolePermission.findOneAndUpdate(
      { role, feature },
      { enabled, updatedBy: req.user.email || req.user.id },
      { new: true, upsert: true }
    );

    // Create audit log
    await AuditLog.create({
      action: "update_permission",
      role,
      feature,
      performedBy: req.user.email || req.user.id,
      details: { enabled },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Seed defaults
router.post("/seed", async (req, res, next) => {
  try {
    // Basic defaults if needed
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
