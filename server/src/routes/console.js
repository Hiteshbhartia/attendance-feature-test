import { crudRouter } from "../lib/crud.js";
import { ConsoleState } from "../models/index.js";
export default crudRouter(ConsoleState, { filterFields: ["actorId", "date"], sort: { date: -1 } });
