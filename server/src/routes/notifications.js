import { crudRouter } from "../lib/crud.js";
import { Notification } from "../models/index.js";
export default crudRouter(Notification, {
  filterFields: ["toId", "kind", "read"],
  sort: { ts: -1 },
});
