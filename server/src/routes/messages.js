import { ChatMessage } from "../models/index.js";
import { crudRouter } from "../lib/crud.js";

// Uses the generic CRUD router which handles bulk-upsert protection automatically
// We also allow filtering by threadId
const router = crudRouter(ChatMessage, { filterFields: ["threadId"] });

export default router;
