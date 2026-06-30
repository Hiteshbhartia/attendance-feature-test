import { crudRouter } from "../lib/crud.js";
import { OneOnOne } from "../models/index.js";
export default crudRouter(OneOnOne, {
  filterFields: ["managerId", "reportId", "status"],
  sort: { scheduledAt: -1 },
});
