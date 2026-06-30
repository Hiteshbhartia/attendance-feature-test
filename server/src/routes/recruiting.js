import { crudRouter } from "../lib/crud.js";
import { Candidate } from "../models/index.js";
export default crudRouter(Candidate, {
  filterFields: ["stage", "recruiterId", "role"],
  sort: { appliedAt: -1 },
});
