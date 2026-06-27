import { crudRouter } from "../lib/crud.js";
import { Employee } from "../models/index.js";
export default crudRouter(Employee, {
  filterFields: ["role", "managerId", "hubId"],
  sort: { name: 1 },
});
