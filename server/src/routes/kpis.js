import { Router } from "express";
import crypto from "node:crypto";
import { KpiDefinition, KpiTarget, Employee, User } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../lib/async-handler.js";

const router = Router();

// --- Helper Functions ---

async function getActorTier(userId, employeeId) {
  const user = await User.findById(userId);
  if (user && (user.role === "admin" || user.appRole === "admin")) return "leadership";

  if (!employeeId) return "teammate";

  const emp = await Employee.findOne({ id: employeeId });
  if (!emp) return "teammate";

  const role = emp.role;
  if (role === "Admin") return "leadership";
  if (role === "Zone Leader") return "zone_leader";
  if (role === "Property Partner" || role === "Owner") return "partner";
  if (role === "HR") return "hr";
  if (role === "Floor Lead" || role === "Coach") return "leader";
  if (role === "Recruiter") return "recruiter";

  return "teammate";
}

function requireKpiCapability(cap) {
  return async (req, res, next) => {
    try {
      const tier = await getActorTier(req.user.id, req.user.employeeId);
      const appRole = req.user.role;

      if (tier === "leadership" || appRole === "admin") {
        req.actorTier = tier;
        return next();
      }

      let allowed = false;
      switch (cap) {
        case "view_kpi_governance":
          allowed = ["leadership", "hr", "zone_leader", "leader"].includes(tier);
          break;

        case "manage_kpi_definitions":
          allowed = false; // only admin/leadership
          break;

        case "manage_org_kpi_targets":
          allowed = tier === "hr";
          break;

        case "manage_zone_kpi_targets":
          allowed = ["zone_leader", "hr"].includes(tier);
          break;

        case "manage_team_kpi_targets":
          allowed = ["leader", "zone_leader", "hr"].includes(tier);
          break;

        case "submit_kpi_values":
          allowed = tier !== "partner";
          break;

        default:
          allowed = false;
      }

      if (!allowed) {
        return res
          .status(403)
          .json({ error: `Forbidden: insufficient permissions for capability ${cap}` });
      }

      req.actorTier = tier;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function generateKpiId() {
  return `kpi-${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`;
}

function generateTargetId() {
  return `tgt-${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`;
}

// --- KPI DEFINITIONS ROUTES ---

// GET /api/kpis - Get definitions
router.get(
  "/kpis",
  requireAuth,
  asyncHandler(async (req, res) => {
    const tier = await getActorTier(req.user.id, req.user.employeeId);

    // Build query
    const query = {};
    if (req.query.active !== undefined) {
      query.active = req.query.active === "true";
    }
    if (req.query.category) {
      query.category = req.query.category;
    }
    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: "i" };
    }

    // Visibility filtering for standard teammates (redundant now but keeping just in case)
    if (tier === "teammate" || tier === "partner") {
      query.visibilityScope = { $in: ["public", "team"] };
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "50", 10)));
    const skip = (page - 1) * limit;

    const [definitions, total] = await Promise.all([
      KpiDefinition.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      KpiDefinition.countDocuments(query),
    ]);

    res.json({
      ok: true,
      definitions: definitions || [],
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  }),
);

// POST /api/kpis - Create KPI definition
router.post(
  "/kpis",
  requireAuth,
  requireKpiCapability("manage_kpi_definitions"),
  asyncHandler(async (req, res) => {
    const {
      name,
      slug,
      description,
      category,
      unit,
      frequency,
      aggregationType,
      visibilityScope,
      ownerRole,
      targetType,
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: "Name and slug are required" });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    const existing = await KpiDefinition.findOne({ slug: cleanSlug });
    if (existing) {
      return res.status(409).json({ error: `KPI with slug '${cleanSlug}' already exists` });
    }

    const newKpi = await KpiDefinition.create({
      id: generateKpiId(),
      name,
      slug: cleanSlug,
      description,
      category: category || "General",
      unit: unit || "count",
      frequency: frequency || "daily",
      aggregationType: aggregationType || "sum",
      visibilityScope: visibilityScope || "public",
      ownerRole: ownerRole || "Operator",
      targetType: targetType || "min",
      active: true,
      version: 1,
      createdBy: req.user.email || req.user.id,
      updatedBy: req.user.email || req.user.id,
      history: [],
    });

    res.status(201).json({ ok: true, definition: newKpi });
  }),
);

// PATCH /api/kpis/:id - Update KPI definition
router.patch(
  "/kpis/:id",
  requireAuth,
  requireKpiCapability("manage_kpi_definitions"),
  asyncHandler(async (req, res) => {
    const kpi = await KpiDefinition.findOne({ id: req.params.id });
    if (!kpi) {
      return res.status(404).json({ error: "KPI Definition not found" });
    }

    const updateFields = {};
    const changes = {};
    const allowedFields = [
      "name",
      "description",
      "category",
      "unit",
      "frequency",
      "aggregationType",
      "visibilityScope",
      "ownerRole",
      "targetType",
      "active",
      "deprecated",
      "replacedBy",
    ];

    for (const key of allowedFields) {
      if (req.body[key] !== undefined && req.body[key] !== kpi[key]) {
        updateFields[key] = req.body[key];
        changes[key] = { from: kpi[key], to: req.body[key] };
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.json({ ok: true, definition: kpi });
    }

    // Save history
    kpi.history.push({
      version: kpi.version,
      updatedBy: req.user.email || req.user.id,
      updatedAt: Date.now(),
      changes,
    });

    kpi.version += 1;
    kpi.updatedBy = req.user.email || req.user.id;

    for (const [key, value] of Object.entries(updateFields)) {
      kpi[key] = value;
    }

    await kpi.save();

    res.json({ ok: true, definition: kpi });
  }),
);

// POST /api/kpis/:id/archive - Archive KPI definition (Soft Delete)
router.post(
  "/kpis/:id/archive",
  requireAuth,
  requireKpiCapability("manage_kpi_definitions"),
  asyncHandler(async (req, res) => {
    const kpi = await KpiDefinition.findOne({ id: req.params.id });
    if (!kpi) {
      return res.status(404).json({ error: "KPI Definition not found" });
    }

    if (!kpi.active) {
      return res.status(400).json({ error: "KPI is already archived" });
    }

    kpi.history.push({
      version: kpi.version,
      updatedBy: req.user.email || req.user.id,
      updatedAt: Date.now(),
      changes: { active: { from: true, to: false } },
    });

    kpi.active = false;
    kpi.archivedAt = Date.now();
    kpi.version += 1;
    kpi.updatedBy = req.user.email || req.user.id;

    await kpi.save();

    res.json({ ok: true, definition: kpi });
  }),
);

// --- KPI TARGETS ROUTES ---

// GET /api/kpi-targets - Get targets
router.get(
  "/kpi-targets",
  requireAuth,
  asyncHandler(async (req, res) => {
    const tier = await getActorTier(req.user.id, req.user.employeeId);

    const query = {};
    if (req.query.kpiId) {
      query.kpiId = req.query.kpiId;
    }
    if (req.query.scopeType) {
      query.scopeType = req.query.scopeType;
    }
    if (req.query.scopeId) {
      query.scopeId = req.query.scopeId;
    }

    // Role restrictions: standard employee or partner cannot search query global scopes of other people
    const appRole = req.user.role;
    if (appRole === "employee" && req.user.employeeId) {
      const emp = await Employee.findOne({ id: req.user.employeeId }).lean();
      const zone = emp?.profile?.zone || emp?.hubId || "HQ";
      const team = emp?.profile?.team || emp?.hubId || "HQ";

      // If they specify a scopeId, ensure it's their own or their team's/zone's/org's
      if (query.scopeId) {
        const allowedIds = ["org", req.user.employeeId, zone, team];
        if (!allowedIds.includes(query.scopeId)) {
          return res.status(200).json({ targets: [] });
        }
      } else {
        // Limit query to their allowed scopes
        query.scopeId = { $in: ["org", req.user.employeeId, zone, team] };
      }
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "50", 10)));
    const skip = (page - 1) * limit;

    const [targets, total] = await Promise.all([
      KpiTarget.find(query).sort({ effectiveFrom: -1 }).skip(skip).limit(limit).lean(),
      KpiTarget.countDocuments(query),
    ]);

    res.json({
      ok: true,
      targets: targets || [],
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  }),
);

// Helper check for scope creation permission
async function checkScopePermission(req, scopeType) {
  const cap =
    scopeType === "org"
      ? "manage_org_kpi_targets"
      : scopeType === "zone"
        ? "manage_zone_kpi_targets"
        : scopeType === "team"
          ? "manage_team_kpi_targets"
          : "manage_team_kpi_targets"; // individual is manager capability

  const tier = await getActorTier(req.user.id, req.user.employeeId);
  const appRole = req.user.role;

  if (tier === "leadership" || appRole === "admin") {
    return true;
  }

  if (cap === "manage_org_kpi_targets" && tier === "hr") return true;
  if (cap === "manage_zone_kpi_targets" && ["zone_leader", "hr"].includes(tier)) return true;
  if (cap === "manage_team_kpi_targets" && ["leader", "zone_leader", "hr"].includes(tier))
    return true;

  return false;
}

// POST /api/kpi-targets - Set target
router.post(
  "/kpi-targets",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { kpiId, scopeType, scopeId, targetValue, effectiveFrom, effectiveTo, notes, ownerId } =
      req.body;

    if (
      !kpiId ||
      !scopeType ||
      !scopeId ||
      targetValue === undefined ||
      !effectiveFrom ||
      !effectiveTo
    ) {
      return res.status(400).json({ error: "Missing required target fields" });
    }

    const hasAccess = await checkScopePermission(req, scopeType);
    if (!hasAccess) {
      return res
        .status(403)
        .json({ error: `Forbidden: insufficient permissions to manage ${scopeType} targets` });
    }

    const kpi = await KpiDefinition.findOne({ id: kpiId });
    if (!kpi) {
      return res.status(404).json({ error: "KPI Definition not found" });
    }

    const newTarget = await KpiTarget.create({
      id: generateTargetId(),
      kpiId,
      scopeType,
      scopeId,
      targetValue: Number(targetValue),
      effectiveFrom,
      effectiveTo,
      ownerId: ownerId || req.user.employeeId,
      notes,
      version: 1,
      updatedBy: req.user.email || req.user.id,
      history: [],
    });

    res.status(201).json({ ok: true, target: newTarget });
  }),
);

// PATCH /api/kpi-targets/:id - Update target
router.patch(
  "/kpi-targets/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const target = await KpiTarget.findOne({ id: req.params.id });
    if (!target) {
      return res.status(404).json({ error: "KPI Target not found" });
    }

    const hasAccess = await checkScopePermission(req, target.scopeType);
    if (!hasAccess) {
      return res.status(403).json({
        error: `Forbidden: insufficient permissions to manage ${target.scopeType} targets`,
      });
    }

    const updateFields = {};
    const allowedFields = ["targetValue", "effectiveFrom", "effectiveTo", "notes", "ownerId"];

    for (const key of allowedFields) {
      if (req.body[key] !== undefined && req.body[key] !== target[key]) {
        updateFields[key] = req.body[key];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.json({ ok: true, target });
    }

    // Audit log target updates
    target.history.push({
      version: target.version,
      targetValue: target.targetValue,
      effectiveFrom: target.effectiveFrom,
      effectiveTo: target.effectiveTo,
      notes: target.notes,
      updatedBy: target.updatedBy,
      updatedAt: Date.now(),
    });

    target.version += 1;
    target.updatedBy = req.user.email || req.user.id;

    for (const [key, value] of Object.entries(updateFields)) {
      target[key] = value;
    }

    await target.save();

    res.json({ ok: true, target });
  }),
);

export default router;
