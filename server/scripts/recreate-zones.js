import "dotenv/config";
import mongoose from "mongoose";
import { Zone } from "../src/models/index.js";

async function run() {
  const MONGO = process.env.MONGODB_URI;
  if (!MONGO) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }
  
  await mongoose.connect(MONGO);
  console.log("Connected to MongoDB.");

  // Clean existing zones just in case
  await Zone.deleteMany({});

  const zonesToCreate = [
    // PG Zones
    { id: "z1", name: "Kora Main", city: "Bangalore", type: "PG", pods: 4, leaderId: "e1" },
    { id: "z2", name: "YPR Main", city: "Bangalore", type: "PG", pods: 3, leaderId: "e1" },
    { id: "z3", name: "MWB", city: "Bangalore", type: "PG", pods: 2, leaderId: "e1" },
    { id: "z4", name: "MTP", city: "Bangalore", type: "PG", pods: 2, leaderId: "e1" },
    { id: "z5", name: "WFD/SJU", city: "Bangalore", type: "PG", pods: 4, leaderId: "e1" },
    // Flat Zones
    { id: "z6", name: "Kora Homes", city: "Bangalore", type: "Flat", pods: 3, leaderId: "e1" },
    { id: "z7", name: "MWB Homes", city: "Bangalore", type: "Flat", pods: 2, leaderId: "e1" },
    { id: "z8", name: "Bellandur", city: "Bangalore", type: "Flat", pods: 5, leaderId: "e1" }
  ];

  for (const z of zonesToCreate) {
    await Zone.updateOne({ id: z.id }, { $set: z }, { upsert: true });
  }

  console.log(`Successfully created ${zonesToCreate.length} zones.`);
  await mongoose.disconnect();
}

run().catch(console.error);
