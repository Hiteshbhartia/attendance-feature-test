import { Router } from "express";
import { Zone, Property } from "../models/index.js";

const router = Router();

// GET /api/zones
router.get("/", async (req, res) => {
  try {
    const zones = await Zone.find().lean();
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zones
router.post("/", async (req, res) => {
  try {
    const { id, name, city, pods, leaderId } = req.body;
    if (!id || !name || !city) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const existing = await Zone.findOne({ id });
    if (existing) {
      return res.status(409).json({ error: "Zone with this ID already exists" });
    }
    const zone = new Zone({ id, name, city, pods, leaderId });
    await zone.save();
    res.status(201).json(zone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/zones/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city, pods, leaderId } = req.body;
    const zone = await Zone.findOneAndUpdate(
      { id },
      { name, city, pods, leaderId },
      { new: true }
    );
    if (!zone) return res.status(404).json({ error: "Zone not found" });
    res.json(zone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zones/properties
router.get("/properties", async (req, res) => {
  try {
    const properties = await Property.find().lean();
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
