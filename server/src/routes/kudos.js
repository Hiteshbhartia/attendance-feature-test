import { crudRouter } from "../lib/crud.js";
import { Kudo } from "../models/index.js";
export default crudRouter(Kudo, { filterFields: ["toId", "fromId"], sort: { ts: -1 } });
