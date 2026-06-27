/**
 * scripts/migrate-auth-roles.js
 * One‑time migration: normalize all User.role values to lowercase.
 *
 * Usage: `node scripts/migrate-auth-roles.js`
 *   - Connects to MongoDB using the same connection config as the server.
 *   - Updates any User documents with role values "Admin", "HR", "Manager", "Employee"
 *     to "admin", "hr", "manager", "employee".
 *   - Logs the number of documents modified.
 */

import mongoose from "mongoose";
import { User } from "../server/src/models/index.js"; // adjust path if needed

// Load environment (same .env as server)
import { config } from "dotenv";
config({ path: ".env" });

async function run() {
  if (!process.env.MONGODB_URI) { console.error("MONGODB_URI missing — set it in .env"); process.exit(1); }
const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log("Connected to MongoDB", uri);

  const legacyMap = {
    Admin: "admin",
    HR: "hr",
    Manager: "manager",
    Employee: "employee",
  };

  const bulkOps = [];
  for (const [oldVal, newVal] of Object.entries(legacyMap)) {
    const docs = await User.find({ role: oldVal }).lean();
    if (docs.length) {
      console.log(`Found ${docs.length} users with role "${oldVal}" – will update to "${newVal}"`);
      bulkOps.push({
        updateMany: {
          filter: { role: oldVal },
          update: { $set: { role: newVal } },
        },
      });
    }
  }

  if (bulkOps.length === 0) {
    console.log("No legacy roles found – nothing to migrate.");
  } else {
    const result = await User.bulkWrite(bulkOps);
    console.log("Migration completed.");
    console.log("Matched:", result.matchedCount, "Modified:", result.modifiedCount);
  }

  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch((err) => {
  console.error("Migration error", err);
  process.exit(1);
});
