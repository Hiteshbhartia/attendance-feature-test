import { crudRouter } from "../lib/crud.js";
import { Task } from "../models/index.js";
export default crudRouter(Task, {
  filterFields: ["assigneeId", "status", "priority"],
  sort: { dueAt: 1 },
});
