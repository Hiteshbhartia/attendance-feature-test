import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../lib/async-handler.js";
import { FCMToken } from "../models/index.js";

const router = Router();
router.use(requireAuth);

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const userId = req.user.id;
    const employeeId = req.user.employeeId;

    // Upsert the token to associate it with the current user
    await FCMToken.updateOne(
      { token },
      { $set: { userId, employeeId } },
      { upsert: true }
    );

    res.json({ ok: true });
  })
);

router.post(
  "/unregister",
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    await FCMToken.deleteOne({ token });
    res.json({ ok: true });
  })
);

export default router;
