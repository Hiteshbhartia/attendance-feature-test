import { ChatThread } from "../models/index.js";
import { crudRouter } from "../lib/crud.js";

// Uses the generic CRUD router for fetching threads
const router = crudRouter(ChatThread);

export default router;
