import { Router } from "express";
import { Playbook } from "../models/index.js";

const router = Router();

// GET /api/playbooks
router.get("/", async (req, res) => {
  try {
    const playbooks = await Playbook.find().lean();
    res.json(playbooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
