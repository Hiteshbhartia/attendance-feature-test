import { config } from "dotenv";
import mongoose from "mongoose";
import { Zone, Property, Playbook } from "./src/models/index.js";

config({ path: "./.env" });

const ZONES = [
  // PG Zones
  { id: "z1", name: "Kora Main", city: "Bangalore", leaderId: "e20", pods: 3, type: "PG" },
  { id: "z2", name: "YPR Main", city: "Bangalore", leaderId: "e21", pods: 2, type: "PG" },
  { id: "z3", name: "MWB", city: "Bangalore", leaderId: "e22", pods: 2, type: "PG" },
  { id: "z4", name: "MTP", city: "Bangalore", leaderId: "e23", pods: 2, type: "PG" },
  { id: "z5", name: "WFD/SJU", city: "Bangalore", leaderId: "e24", pods: 2, type: "PG" },
  // Flat Zones
  { id: "z6", name: "Kora Homes", city: "Bangalore", leaderId: "e25", pods: 2, type: "Flat" },
  { id: "z7", name: "MWB Homes", city: "Bangalore", leaderId: "e26", pods: 2, type: "Flat" },
  { id: "z8", name: "Bellandur", city: "Bangalore", leaderId: "e27", pods: 2, type: "Flat" },
];

const PROPERTIES = [
  { id: "p1", zoneId: "z1", name: "Aeris Boys", type: "Colive", address: "Bandra West", rating: 4.2, beds: 100, occupied: 85, monthlyRevenue: 1500000 },
  { id: "p2", zoneId: "z2", name: "Brook Luxe", type: "Colive", address: "Andheri East", rating: 4.5, beds: 120, occupied: 110, monthlyRevenue: 1800000 },
  { id: "p3", zoneId: "z3", name: "Oryn Girls", type: "Colive", address: "Whitefield", rating: 3.8, beds: 80, occupied: 60, monthlyRevenue: 900000 },
  { id: "p4", zoneId: "z4", name: "HSR Hub", type: "Colive", address: "HSR Layout", rating: 4.8, beds: 200, occupied: 195, monthlyRevenue: 3000000 },
];

const PLAYBOOKS = [
  { id: "operator", title: "Playbook operator", steps: [], shieldBlocks: [], sprints: [], commWindows: [], kpis: [], eodFields: [] },
  { id: "manager", title: "Playbook manager", steps: [], shieldBlocks: [], sprints: [], commWindows: [], kpis: [], eodFields: [] }
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  await Zone.deleteMany({});
  await Zone.insertMany(ZONES);
  console.log(`Inserted ${ZONES.length} zones.`);

  await Property.deleteMany({});
  await Property.insertMany(PROPERTIES);
  console.log(`Inserted ${PROPERTIES.length} properties.`);

  await Playbook.deleteMany({});
  await Playbook.insertMany(PLAYBOOKS);
  console.log(`Inserted ${PLAYBOOKS.length} playbooks.`);

  mongoose.disconnect();
  console.log("Done.");
}

run().catch(console.error);
