/**
 * Staging Import v2 — READ/WRITE to employees_staging ONLY.
 *
 * Reads:  exports/legacy-employees-with-hierarchy.xlsx
 * Reads:  Arena MongoDB → users + employees (for conflict detection)
 * Writes: Arena MongoDB → employees_staging (drop + recreate)
 *
 * Does NOT:
 *   - Create users or employees
 *   - Delete any existing collection
 *   - Touch users / employees / rolepermissions / kpidefinitions / kpitargets
 *
 * Run:
 *   ARENA_MONGO_URI="mongodb+srv://..." node scripts/stage-import.js
 *
 * Validation severity levels:
 *   error            → blocks import (must fix)
 *   warning          → importable with HR sign-off
 *   review_required  → informational, does not block (e.g. personal email)
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import ExcelJS from "exceljs";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

config({ path: join(__dirname, ".env") });
config({ path: join(ROOT, ".env") });

const XLSX_PATH = join(ROOT, "exports", "legacy-employees-with-hierarchy.xlsx");
const URI = process.env.ARENA_MONGO_URI;

if (!URI) {
  console.error(
    "\n❌  ARENA_MONGO_URI is not set.\n" +
    "    Add it to scripts/.env:\n" +
    "    ARENA_MONGO_URI=mongodb+srv://...\n"
  );
  process.exit(1);
}

// ── Arena master data (sourced from live Arena DB, confirmed 2026-06-01) ──
// These are the known valid zone and team values in the Arena employees collection.
// Update this list if new zones/teams are added to Arena before migration.
const ARENA_KNOWN_ZONES = new Set([
  "All", "Andheri", "Andheri East", "Bandra", "Bandra West",
  "Bangalore", "HQ", "HSR Layout", "Mumbai", "Whitefield",
]);

const ARENA_KNOWN_TEAMS = new Set([
  "Andheri Hub", "Andheri Zone", "Bandra Hub", "Bandra Zone",
  "Core Operations", "HQ", "HQ Ops", "HSR Zone", "In-Office Floor",
  "People Ops", "Property Partners", "Talent Ops", "Tour Ops",
  "Training", "Whitefield Zone",
]);

// ── Validators ─────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "yahoo.in", "rediffmail.com", "icloud.com",
]);
const TEST_NAME_RE  = /^(test|demo|dummy|sample|admin|superadmin|mwb more|nithya mng|sneha mng|john doe)/i;
const TEST_EMAIL_RE = /^(test|demo|dummy|sample|admin@example|testmanager|mwbmore)/i;

function flag(code, severity, message) {
  return { code, severity, message };
}

/**
 * Validate a single row.
 * arenaEmailSet: Set of all emails already in Arena users + employees collections.
 */
function validateRow(row, arenaEmailSet) {
  const flags = [];
  const email = (row.email ?? "").trim().toLowerCase();
  const name  = (row.fullName ?? "").trim();

  // ── Name ─────────────────────────────────────────────────────────────────
  if (!name) {
    flags.push(flag("MISSING_NAME", "error", "Full name is blank"));
  } else if (!name.includes(" ")) {
    flags.push(flag("SINGLE_NAME", "warning", `Only one name provided: ${name}`));
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  if (!email) {
    flags.push(flag("MISSING_EMAIL", "error", "Email is blank"));
  } else if (!EMAIL_RE.test(email)) {
    flags.push(flag("INVALID_EMAIL", "error", `Email format invalid: ${email}`));
  } else {
    // Personal domain — review_required, NOT an error or warning
    const domain = email.split("@")[1] ?? "";
    if (PERSONAL_DOMAINS.has(domain)) {
      flags.push(flag(
        "PERSONAL_EMAIL",
        "review_required",
        `Personal email domain (${domain}) — confirm this is the employee's work contact`,
      ));
    }

    // Conflict with existing Arena account
    if (arenaEmailSet.has(email)) {
      flags.push(flag(
        "EMAIL_ALREADY_EXISTS_IN_ARENA",
        "error",
        `Email already exists in Arena: ${email} — will conflict on import`,
      ));
    }
  }

  // ── Test account ──────────────────────────────────────────────────────────
  if (TEST_NAME_RE.test(name)) {
    flags.push(flag("PROBABLE_TEST_ACCOUNT", "warning", `Name suggests test account: ${name}`));
  }
  if (email && TEST_EMAIL_RE.test(email)) {
    flags.push(flag("PROBABLE_TEST_ACCOUNT", "warning", `Email suggests test account: ${email}`));
  }

  // ── Manager ───────────────────────────────────────────────────────────────
  const hasMgr = (row.reportingManagerName ?? "").trim() || (row.reportingManagerEmail ?? "").trim();
  if (!hasMgr) {
    flags.push(flag("MISSING_MANAGER", "warning", "No reporting manager assigned"));
  }

  // ── Roles ─────────────────────────────────────────────────────────────────
  if (!(row.arenaOperationalRole ?? "").trim()) {
    flags.push(flag("MISSING_OPERATIONAL_ROLE", "error", "Arena operational role could not be resolved"));
  }
  if (!(row.arenaAppRole ?? "").trim()) {
    flags.push(flag("MISSING_APP_ROLE", "error", "Arena app role could not be resolved"));
  }

  // ── Zone ──────────────────────────────────────────────────────────────────
  const zone = (row.zoneName ?? "").trim();
  if (zone && !ARENA_KNOWN_ZONES.has(zone)) {
    flags.push(flag(
      "UNKNOWN_ZONE",
      "warning",
      `Zone "${zone}" is not in Arena master data — will be created or needs mapping`,
    ));
  }

  // ── Team ──────────────────────────────────────────────────────────────────
  const team = (row.teamName ?? "").trim();
  if (team && !ARENA_KNOWN_TEAMS.has(team)) {
    flags.push(flag(
      "UNKNOWN_TEAM",
      "warning",
      `Team "${team}" is not in Arena master data — will be created or needs mapping`,
    ));
  }

  return flags;
}

// ── Read XLSX ──────────────────────────────────────────────────────────────
async function readXLSX() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  const ws = wb.getWorksheet("Employees with Hierarchy");
  if (!ws) throw new Error('Sheet "Employees with Hierarchy" not found in XLSX');

  const headers = {};
  ws.getRow(1).eachCell((cell, col) => {
    headers[cell.value?.toString().trim() ?? ""] = col;
  });

  const get = (row, header) => {
    const col = headers[header];
    if (!col) return "";
    const v = row.getCell(col).value;
    if (v === null || v === undefined) return "";
    return String(v).trim();
  };

  const rows = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const fullName = get(row, "Full Name");
    if (!fullName && !get(row, "Email")) return;
    rows.push({
      legacyId:              get(row, "Legacy ID"),
      fullName,
      email:                 get(row, "Email").toLowerCase(),
      phone:                 get(row, "Phone"),
      jobRoleLegacy:         get(row, "Job Role (Legacy)"),
      playbookRole:          get(row, "Playbook Role"),
      systemRole:            get(row, "System Role"),
      hierarchyRole:         get(row, "Hierarchy Role"),
      arenaOperationalRole:  get(row, "Arena Operational Role"),
      arenaAppRole:          get(row, "Arena App Role"),
      teamName:              get(row, "Team Name"),
      zoneName:              get(row, "Zone Name"),
      reportingManagerName:  get(row, "Reporting Manager Name"),
      reportingManagerEmail: get(row, "Reporting Manager Email"),
      status:                get(row, "Status"),
      isApproved:            get(row, "Is Approved"),
      dateOfBirth:           get(row, "Date of Birth"),
      createdAt:             get(row, "Created Date"),
    });
  });

  return rows;
}

// ── Derive _validationStatus from flags ────────────────────────────────────
// Priority: error > warning > review_required > ok
function deriveStatus(flags) {
  if (flags.some(f => f.severity === "error"))           return "error";
  if (flags.some(f => f.severity === "warning"))         return "warning";
  if (flags.some(f => f.severity === "review_required")) return "review_required";
  return "ok";
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  STAGING IMPORT v2 — employees_staging only                 ║");
  console.log("║  No deletions. No user creation. No auth changes.           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // 1. Read XLSX
  console.log("📖 Reading XLSX...");
  const rows = await readXLSX();
  console.log(`   Found ${rows.length} rows`);

  // 2. Connect to Arena MongoDB (READ existing users + employees for conflict check)
  console.log("\n🔌 Connecting to Arena MongoDB...");
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 20_000 });
  await client.connect();
  const dbName = URI.match(/\/([^/?]+)(\?|$)/)?.[1] ?? "test";
  const db = client.db(dbName);

  console.log("   Reading existing Arena users and employees for conflict detection...");
  const [arenaUsers, arenaEmps] = await Promise.all([
    db.collection("users").find({}, { projection: { email: 1 } }).toArray(),
    db.collection("employees").find({}, { projection: { email: 1 } }).toArray(),
  ]);

  // Build a set of all emails already in Arena (lowercase, non-blank)
  const arenaEmailSet = new Set([
    ...arenaUsers.map(u => (u.email ?? "").toLowerCase()).filter(Boolean),
    ...arenaEmps.map(e => (e.email ?? "").toLowerCase()).filter(Boolean),
  ]);
  console.log(`   Arena has ${arenaEmailSet.size} existing email addresses`);

  // 3. Detect duplicate emails within the import batch
  const emailCount = {};
  for (const r of rows) {
    const e = r.email;
    if (e) emailCount[e] = (emailCount[e] ?? 0) + 1;
  }
  const duplicateEmails = new Set(
    Object.entries(emailCount).filter(([, n]) => n > 1).map(([e]) => e)
  );

  // 4. Validate each row
  const docs = rows.map((row, i) => {
    const flags = validateRow(row, arenaEmailSet);

    // Duplicate within batch
    if (row.email && duplicateEmails.has(row.email)) {
      flags.push(flag("DUPLICATE_EMAIL", "error", `Duplicate email in import batch: ${row.email}`));
    }

    const validationStatus = deriveStatus(flags);
    const importReady = validationStatus !== "error";

    return {
      _stagingId:        i + 1,
      _flags:            flags,
      _validationStatus: validationStatus,
      _importReady:      importReady,
      _stagedAt:         new Date(),
      ...row,
    };
  });

  // 5. Drop and recreate employees_staging
  console.log("\n🗑️  Dropping employees_staging (if exists)...");
  try {
    await db.collection("employees_staging").drop();
    console.log("   Dropped");
  } catch (e) {
    if (e.codeName !== "NamespaceNotFound") throw e;
    console.log("   Did not exist — skipping drop");
  }

  // 6. Insert
  console.log("\n📥 Inserting staging documents...");
  const result = await db.collection("employees_staging").insertMany(docs, { ordered: false });
  console.log(`   Inserted ${result.insertedCount} documents into employees_staging`);

  // 7. Indexes
  await db.collection("employees_staging").createIndex({ email: 1 });
  await db.collection("employees_staging").createIndex({ _validationStatus: 1 });
  await db.collection("employees_staging").createIndex({ _importReady: 1 });

  await client.close();

  // 8. Summary
  const total          = docs.length;
  const ready          = docs.filter(d => d._importReady).length;
  const blocked        = docs.filter(d => d._validationStatus === "error").length;
  const warningsOnly   = docs.filter(d => d._validationStatus === "warning").length;
  const reviewRequired = docs.filter(d => d._validationStatus === "review_required").length;
  const clean          = docs.filter(d => d._validationStatus === "ok").length;

  const hasCode = (d, code) => d._flags.some(f => f.code === code);
  const dupCount      = docs.filter(d => hasCode(d, "DUPLICATE_EMAIL")).length;
  const arenaConflict = docs.filter(d => hasCode(d, "EMAIL_ALREADY_EXISTS_IN_ARENA")).length;
  const badEmail      = docs.filter(d => hasCode(d, "INVALID_EMAIL") || hasCode(d, "MISSING_EMAIL")).length;
  const personalEmail = docs.filter(d => hasCode(d, "PERSONAL_EMAIL")).length;
  const testCount     = docs.filter(d => hasCode(d, "PROBABLE_TEST_ACCOUNT")).length;
  const noMgr         = docs.filter(d => hasCode(d, "MISSING_MANAGER")).length;
  const unknownZone   = docs.filter(d => hasCode(d, "UNKNOWN_ZONE")).length;
  const unknownTeam   = docs.filter(d => hasCode(d, "UNKNOWN_TEAM")).length;

  const SEP = "═".repeat(64);
  console.log("\n" + SEP);
  console.log("  STAGING COMPLETE — employees_staging ready for HR review");
  console.log(SEP);
  console.log(`\n  Total employees staged:         ${total}`);
  console.log(`  ✅ Import ready:                 ${ready}`);
  console.log(`  ❌ Blocked (errors):             ${blocked}`);
  console.log(`  ⚠️  Warnings only:                ${warningsOnly}`);
  console.log(`  🔍 Review required (info only):  ${reviewRequired}`);
  console.log(`  ✅ Clean:                        ${clean}`);
  console.log(`\n  EMAIL_ALREADY_EXISTS_IN_ARENA:  ${arenaConflict}`);
  console.log(`  DUPLICATE_EMAIL (in batch):      ${dupCount}`);
  console.log(`  INVALID/MISSING_EMAIL:           ${badEmail}`);
  console.log(`  PERSONAL_EMAIL (review only):    ${personalEmail}`);
  console.log(`  PROBABLE_TEST_ACCOUNT:           ${testCount}`);
  console.log(`  MISSING_MANAGER:                 ${noMgr}`);
  console.log(`  UNKNOWN_ZONE:                    ${unknownZone}`);
  console.log(`  UNKNOWN_TEAM:                    ${unknownTeam}`);
  console.log(`\n  Next step: node scripts/generate-final-xlsx.js`);
  console.log(SEP + "\n");
}

main().catch(err => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
