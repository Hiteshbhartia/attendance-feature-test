import { crudRouter } from "../lib/crud.js";
import { Leave } from "../models/index.js";
export default crudRouter(Leave, {
  filterFields: ["employeeId", "status", "type"],
  sort: { appliedAt: -1 },
});
