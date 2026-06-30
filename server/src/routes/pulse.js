import { crudRouter } from "../lib/crud.js";
import { PulseEntry } from "../models/index.js";

export default crudRouter(PulseEntry, {
  filterFields: ["employeeId", "date", "slot"],
  sort: { submittedAt: -1 },
});
