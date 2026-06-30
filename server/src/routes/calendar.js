import { crudRouter } from "../lib/crud.js";
import { CalEvent } from "../models/index.js";
export default crudRouter(CalEvent, { filterFields: ["type", "ownerId"], sort: { startAt: 1 } });
