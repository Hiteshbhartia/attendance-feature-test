import { Router } from "express";
import { crudRouter } from "../lib/crud.js";
import { FlyUpdate, FlyRetro, FlyFeed } from "../models/index.js";

const router = Router();

router.use(
  "/updates",
  crudRouter(FlyUpdate, { filterFields: ["authorId", "date"], sort: { createdAt: -1 } }),
);
router.use(
  "/retro",
  crudRouter(FlyRetro, { filterFields: ["authorId", "kind"], sort: { createdAt: -1 } }),
);
router.use(
  "/feed",
  crudRouter(FlyFeed, { filterFields: ["authorId", "kind", "zone"], sort: { ts: -1 } }),
);

export default router;
