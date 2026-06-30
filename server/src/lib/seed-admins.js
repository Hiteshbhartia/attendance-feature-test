import { User } from "../models/index.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function seedAdmins() {
  const admins = [
    { email: "admin1@gharpayy.com", name: "Admin One", role: "admin" },
    { email: "admin2@gharpayy.com", name: "Admin Two", role: "admin" },
  ];

  for (const admin of admins) {
    const existing = await User.findOne({ email: admin.email }).lean();
    if (!existing) {
      const passwordHash = await bcrypt.hash("Admin123!", 10);
      await User.create({
        email: admin.email, 
        name: admin.name,
        role: admin.role,
        passwordHash,
        status: "active",
        isApproved: true,
        employeeId: crypto.randomUUID(),
      });
      console.log(`[api] seeded admin: ${admin.email}`);
    }
  }
}
