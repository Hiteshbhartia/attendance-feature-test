import mongoose from 'mongoose';
import { Playbook } from './src/models/index.js';

const OPERATOR_PLAYBOOK = {
  id: "operator",
  title: "Operator Playbook",
  subtitle: "Daily execution for Operations",
  oneLiner: "Keep the floor running smoothly.",
  collapseRule: "If attendance is not locked by 10:35 AM, the shift is uncontrolled.",
  interdependence: "Sales relies on Operator to ensure properties are tour-ready.",
  steps: [
    { id: "s1", title: "Morning Sync", required: true },
    { id: "s2", title: "Lock Attendance", required: true },
    { id: "s3", title: "Check-in with pods", required: true },
  ],
  shieldBlocks: [
    { startMin: 540, endMin: 630, label: "Morning Hustle (No Meetings)" }, // 9:00 - 10:30
  ],
  sprints: [
    { startMin: 630, endMin: 810, label: "Core Operations Sprint" }, // 10:30 - 13:30
    { startMin: 870, endMin: 1050, label: "Closing Sprint" }, // 14:30 - 17:30
  ],
  commWindows: [
    { atMin: 600, label: "Morning Standup" }, // 10:00
    { atMin: 1020, label: "EOD Sync" }, // 17:00
  ],
  kpis: [
    { id: "operator_day_ride_along", kind: "boolean", target: 1 },
    { id: "people_pulse_att_locked", kind: "boolean", target: 1 },
    { id: "communication_shield_conn", kind: "count", target: 70 },
  ],
  eodFields: [
    { id: "blockers", label: "Blockers", kind: "text" },
    { id: "tour_outcome", label: "Tour outcome", kind: "text" },
    { id: "escalations", label: "Any escalations?", kind: "yesno" }
  ]
};

const SALES_PLAYBOOK = {
  id: "sales",
  title: "Sales Playbook",
  subtitle: "Daily execution for Sales",
  oneLiner: "Close deals and drive revenue.",
  collapseRule: "If leads aren't touched within 5 mins, conversion drops by 50%.",
  interdependence: "Relies on Marketing for MQLs.",
  steps: [
    { id: "s1", title: "Pipeline Review", required: true },
    { id: "s2", title: "Follow-ups", required: true },
    { id: "s3", title: "Prospecting", required: true },
  ],
  shieldBlocks: [],
  sprints: [],
  commWindows: [],
  kpis: [],
  eodFields: [
    { id: "deals_closed", label: "Deals Closed", kind: "text" },
    { id: "pipeline_value", label: "Pipeline Value Generated", kind: "text" }
  ]
};

const FLOOR_LEAD_PLAYBOOK = { ...OPERATOR_PLAYBOOK, id: "floor_lead", title: "Floor Lead Playbook" };

const MANAGER_PLAYBOOK = { ...OPERATOR_PLAYBOOK, id: "manager", title: "Manager Playbook" };
const ADMIN_PLAYBOOK = { ...OPERATOR_PLAYBOOK, id: "admin", title: "Admin Playbook" };

import { config } from 'dotenv';
config();

async function seedPlaybooks() {
  await mongoose.connect('mongodb+srv://amitgharpayy_db_user:mq5vEo6GhguGPNlt@cluster0.v9e2dxi.mongodb.net/?appName=Cluster0');
  await Playbook.deleteMany({});
  await Playbook.insertMany([OPERATOR_PLAYBOOK, SALES_PLAYBOOK, FLOOR_LEAD_PLAYBOOK, MANAGER_PLAYBOOK, ADMIN_PLAYBOOK]);
  console.log("Playbooks seeded!");
  process.exit(0);
}

seedPlaybooks().catch(err => {
  console.error(err);
  process.exit(1);
});
