import { User } from "../models/index.js";

export async function runWorkforceMigrations() {
  try {
    console.log("[migration] Running workforce status migrations...");

    // 1. If status is missing/null and isApproved is true -> status = "active"
    const result1 = await User.updateMany(
      {
        isApproved: true,
        $or: [{ status: { $exists: false } }, { status: null }],
      },
      {
        $set: { status: "active" },
      },
    );
    console.log(`[migration] Migrated ${result1.modifiedCount} approved users to status 'active'`);

    // 2. If isSuspended === true -> status = "suspended"
    const result2 = await User.updateMany(
      {
        isSuspended: true,
        status: { $ne: "suspended" },
      },
      {
        $set: { status: "suspended" },
      },
    );
    console.log(
      `[migration] Migrated ${result2.modifiedCount} suspended users to status 'suspended'`,
    );

    // 3. If user has status === "rejected", ensure isApproved is false
    const result3 = await User.updateMany(
      {
        status: "rejected",
        isApproved: { $ne: false },
      },
      {
        $set: { isApproved: false },
      },
    );
    console.log(
      `[migration] Aligned ${result3.modifiedCount} rejected users with isApproved = false`,
    );

    // 4. Default any remaining users with missing status to "pending"
    const result4 = await User.updateMany(
      {
        $or: [{ status: { $exists: false } }, { status: null }],
      },
      {
        $set: { status: "pending" },
      },
    );
    console.log(`[migration] Defaulted ${result4.modifiedCount} users to status 'pending'`);

    console.log("[migration] Workforce status migrations completed successfully.");
  } catch (err) {
    console.error("[migration] Failed to run workforce status migrations:", err);
  }
}
