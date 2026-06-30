import { crudRouter } from "../lib/crud.js";
import { Attendance } from "../models/index.js";
export default crudRouter(Attendance, {
  filterFields: ["employeeId", "date", "status"],
  sort: { date: -1 },
});
