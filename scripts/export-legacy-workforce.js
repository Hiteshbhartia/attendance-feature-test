/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  LEGACY HRMS WORKFORCE EXPORT — READ ONLY                          ║
 * ║  Connects to legacy Atlas cluster.                                  ║
 * ║  Extracts employees + hierarchy. Writes CSV + XLSX + summary MD.   ║
 * ║  ZERO writes to any MongoDB database.                               ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   LEGACY_MONGO_URI="mongodb+srv://..." node scripts/export-legacy-workforce.js
 *
 * Or create scripts/.env with:
 *   LEGACY_MONGO_URI=mongodb+srv://...
 */

import { MongoClient } from "mongodb";
import ExcelJS from "exceljs";
import { createWriteStream, mkdirSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

// ── Bootstrap ──────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const EXPORTS   = join(ROOT, "exports");

// Load .env from scripts/ first, then project root
config({ path: join(__dirname, ".env") });
config({ path: join(ROOT, ".env") });

const URI = process.env.LEGACY_MONGO_URI;
if (!URI) {
  console.error(
    "\n❌  LEGACY_MONGO_URI is not set.\n" +
    "    Set it as an environment variable or add it to scripts/.env\n" +
    "    Example: LEGACY_MONGO_URI=\"mongodb+srv://user:pass@host/?appName=X\"\n"
  );
  process.exit(1);
}

// Ensure exports directory exists
mkdirSync(EXPORTS, { recursive: true });

const CSV_PATH  = join(EXPORTS, "legacy-employees.csv");
const XLSX_PATH = join(EXPORTS, "legacy-employees.xlsx");
const MD_PATH   = join(EXPORTS, "migration-summary.md");

// ── Column definitions ─────────────────────────────────────────────────────
const COLUMNS = [
  { key: "employeeId",           header: "Employee ID" },
  { key: "fullName",             header: "Full Name" },
  { key: "email",                header: "Email" },
  { key: "phone",                header: "Phone" },
  { key: "operationalRole",      header: "Operational Role" },
  { key: "appRole",              header: "Application Role" },
  { key: "designation",          header: "Designation / Job Role" },
  { key: "zoneName",             header: "Zone" },
  { key: "teamName",             header: "Team / Squad" },
  { key: "reportingManagerName", header: "Reporting Manager" },
  { key: "reportingManagerEmail",header: "Reporting Manager Email" },
  { key: "status",               header: "Status" },
  { key: "isApproved",           header: "Is Approved" },
  { key: "dateOfBirth",          header: "Date of Birth" },
  { key: "profilePhoto",         header: "Profile Photo URL" },
  { key: "officeZoneId",         header: "Office Zone ID (raw)" },
  { key: "teamId",               header: "Team ID (raw)" },
  { key: "managerId",            header: "Manager ID (raw)" },
  { key: "createdAt",            header: "Created Date" },
  { key: "updatedAt",            header: "Updated Date" },
  { key: "_sourceId",            header: "Legacy _id" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function safe(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && v.constructor?.name === "ObjectId") return v.toString();
  return String(v);
}

function csvEscape(v) {
  const s = safe(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function countBy(arr, fn) {
  const out = {};
  for (const x of arr) {
    const k = safe(fn(x)) || "(blank)";
    out[k] = (out[k] ?? 0) + 1;
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}

function findDuplicates(arr, fn) {
  const seen = {};
  const dupes = [];
  for (const x of arr) {
    const k = safe(fn(x));
    if (!k) continue;
    seen[k] = (seen[k] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(seen)) {
    if (n > 1) dupes.push({ value: k, count: n });
  }
  return dupes.sort((a, b) => b.count - a.count);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  LEGACY HRMS WORKFORCE EXPORT — READ ONLY                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const client = new MongoClient(URI, {
    serverSelectionTimeoutMS: 20_000,
    connectTimeoutMS: 20_000,
    // Explicitly disable any write concern to make intent clear
    writeConcern: { w: 0 },
  });

  try {
    await client.connect();
    console.log("✅ Connected to legacy cluster\n");

    const db = client.db("gharpayy-attendance");

    // ── Step 1: Read all reference collections ─────────────────────────────
    console.log("📖 Reading reference collections...");

    let zones = [], teams = [], hierarchyRoles = [];

    try {
      zones = await db.collection("gpofficezones").find({}).toArray();
      console.log(`   gpofficezones:      ${zones.length} docs`);
    } catch (e) {
      console.warn("   ⚠️  gpofficezones unavailable:", e.message);
    }

    try {
      teams = await db.collection("gp_teams").find({}).toArray();
      console.log(`   gp_teams:           ${teams.length} docs`);
    } catch (e) {
      console.warn("   ⚠️  gp_teams unavailable:", e.message);
    }

    try {
      hierarchyRoles = await db.collection("gp_hierarchy_roles").find({}).toArray();
      console.log(`   gp_hierarchy_roles: ${hierarchyRoles.length} docs`);
    } catch (e) {
      console.warn("   ⚠️  gp_hierarchy_roles unavailable:", e.message);
    }

    // Build lookup maps
    const zoneById  = new Map(zones.map(z => [z._id.toString(), z]));
    const teamById  = new Map(teams.map(t => [t._id.toString(), t]));
    const roleBySlug = new Map(hierarchyRoles.map(r => [r.slug ?? r.name, r]));

    // ── Step 2: Read all employees ─────────────────────────────────────────
    console.log("\n📖 Reading gpattusers (employees)...");

    let rawEmployees = [];
    try {
      rawEmployees = await db.collection("gpattusers")
        .find({}, { projection: { password: 0, passwordHash: 0, pinHash: 0 } })
        .toArray();
      console.log(`   Found ${rawEmployees.length} employee records`);
    } catch (e) {
      console.error("❌ Could not read gpattusers:", e.message);
      console.error("   This database may require a different network or VPN.");
      process.exit(1);
    }

    // Build employee lookup by _id for manager resolution
    const empById = new Map(rawEmployees.map(e => [e._id.toString(), e]));

    // ── Step 3: Resolve hierarchy and enrich records ───────────────────────
    console.log("\n🔗 Resolving hierarchy and enriching records...");

    const enriched = rawEmployees.map(emp => {
      // Zone resolution
      const zoneIdStr = emp.officeZoneId?.toString() ?? "";
      const zone = zoneById.get(zoneIdStr);
      const zoneName = zone?.name ?? zone?.zoneName ?? "";

      // Team resolution — find team where this employee is a member
      const empIdStr = emp._id.toString();
      const team = teams.find(t =>
        t.managerId?.toString() === empIdStr ||
        (Array.isArray(t.members) && t.members.some(m => m?.toString() === empIdStr))
      );
      const teamName = team?.name ?? team?.slug ?? "";
      const teamId   = team?._id?.toString() ?? "";

      // Manager resolution — look for managerId on the employee doc
      const rawManagerId = emp.managerId ?? emp.reportingTo ?? emp.reportsTo ?? null;
      const managerIdStr = rawManagerId?.toString() ?? "";
      const manager = managerIdStr ? empById.get(managerIdStr) : null;
      const reportingManagerName  = manager?.fullName ?? manager?.name ?? "";
      const reportingManagerEmail = manager?.email ?? "";

      // Role resolution
      const operationalRole = emp.role ?? emp.jobRole ?? emp.designation ?? "";
      const roleRecord = roleBySlug.get(operationalRole);
      // Map legacy system roles to Arena app roles
      const appRole = resolveAppRole(emp, roleRecord);

      // Status
      const status = emp.status ?? (emp.isApproved ? "active" : "pending") ?? "";

      return {
        employeeId:            emp.employeeId ?? emp._id.toString(),
        fullName:              emp.fullName ?? emp.name ?? "",
        email:                 emp.email ?? "",
        phone:                 emp.phone ?? emp.mobile ?? "",
        operationalRole,
        appRole,
        designation:           emp.jobRole ?? emp.designation ?? emp.role ?? "",
        zoneName,
        teamName,
        reportingManagerName,
        reportingManagerEmail,
        status,
        isApproved:            emp.isApproved ?? "",
        dateOfBirth:           emp.dateOfBirth ? safe(emp.dateOfBirth) : "",
        profilePhoto:          emp.profilePhoto ?? "",
        officeZoneId:          zoneIdStr,
        teamId,
        managerId:             managerIdStr,
        createdAt:             emp.createdAt ? safe(emp.createdAt) : "",
        updatedAt:             emp.updatedAt ? safe(emp.updatedAt) : "",
        _sourceId:             emp._id.toString(),
        // Keep raw doc for debugging
        _raw: emp,
      };
    });

    console.log(`   Enriched ${enriched.length} records`);

    // ── Step 4: Write CSV ──────────────────────────────────────────────────
    console.log("\n📄 Writing CSV...");
    await writeCSV(enriched);
    console.log(`   ✅ ${CSV_PATH}`);

    // ── Step 5: Write XLSX ─────────────────────────────────────────────────
    console.log("\n📊 Writing XLSX...");
    await writeXLSX(enriched);
    console.log(`   ✅ ${XLSX_PATH}`);

    // ── Step 6: Data quality analysis ─────────────────────────────────────
    console.log("\n🔍 Analysing data quality...");
    const issues = analyseQuality(enriched);

    // ── Step 7: Write summary MD ───────────────────────────────────────────
    console.log("\n📝 Writing summary report...");
    const md = buildSummary(enriched, issues, zones, teams, hierarchyRoles);
    await writeFile(MD_PATH, md, "utf8");
    console.log(`   ✅ ${MD_PATH}`);

    // ── Final console report ───────────────────────────────────────────────
    printFinalReport(enriched, issues);

  } catch (err) {
    console.error("\n❌ Fatal error:", err.message);
    if (err.code) console.error("   Code:", err.code);
    throw err;
  } finally {
    await client.close();
    console.log("\n🔒 Connection closed. No data was modified.\n");
  }
}

// ── Role mapping ───────────────────────────────────────────────────────────
function resolveAppRole(emp, roleRecord) {
  // If the legacy system has an explicit appRole field, use it
  if (emp.appRole) return emp.appRole;

  // Map from hierarchy role system
  if (roleRecord) {
    if (roleRecord.systemRole === "admin" || roleRecord.level === 1) return "admin";
    if (roleRecord.canManageTeam) return "manager";
    return "employee";
  }

  // Fallback: infer from role string
  const r = (emp.role ?? emp.jobRole ?? "").toLowerCase();
  if (r.includes("admin") || r.includes("super")) return "admin";
  if (r.includes("manager") || r.includes("lead") || r.includes("zone") || r.includes("head")) return "manager";
  if (r.includes("hr")) return "manager";
  return "employee";
}

// ── CSV writer ─────────────────────────────────────────────────────────────
async function writeCSV(rows) {
  const header = COLUMNS.map(c => csvEscape(c.header)).join(",");
  const lines  = [header];

  for (const row of rows) {
    const line = COLUMNS.map(c => csvEscape(row[c.key])).join(",");
    lines.push(line);
  }

  await writeFile(CSV_PATH, lines.join("\n"), "utf8");
}

// ── XLSX writer ────────────────────────────────────────────────────────────
async function writeXLSX(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator  = "Arena Export Script";
  wb.created  = new Date();
  wb.modified = new Date();

  // ── Sheet 1: Employees ──────────────────────────────────────────────────
  const ws = wb.addWorksheet("Employees", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = COLUMNS.map(c => ({
    header: c.header,
    key:    c.key,
    width:  Math.max(c.header.length + 4, 20),
  }));

  // Header row styling
  ws.getRow(1).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border    = {
      bottom: { style: "thin", color: { argb: "FFAAAAAA" } },
    };
  });

  // Data rows
  for (const row of rows) {
    const values = {};
    for (const col of COLUMNS) {
      values[col.key] = safe(row[col.key]);
    }
    const wsRow = ws.addRow(values);

    // Highlight rows with missing email in yellow
    if (!row.email) {
      wsRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
      });
    }
    // Highlight rows with missing manager in light orange
    if (!row.reportingManagerName && !row.managerId) {
      wsRow.getCell("reportingManagerName").fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE8D8" },
      };
    }
  }

  // Auto-filter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: COLUMNS.length },
  };

  // ── Sheet 2: Zone Summary ───────────────────────────────────────────────
  const wsZones = wb.addWorksheet("Zone Summary");
  wsZones.columns = [
    { header: "Zone",  key: "zone",  width: 30 },
    { header: "Count", key: "count", width: 10 },
  ];
  wsZones.getRow(1).font = { bold: true };
  const zoneCounts = countBy(rows, r => r.zoneName || "(no zone)");
  for (const [zone, count] of zoneCounts) wsZones.addRow({ zone, count });

  // ── Sheet 3: Role Summary ───────────────────────────────────────────────
  const wsRoles = wb.addWorksheet("Role Summary");
  wsRoles.columns = [
    { header: "Operational Role", key: "role",  width: 30 },
    { header: "Count",            key: "count", width: 10 },
  ];
  wsRoles.getRow(1).font = { bold: true };
  const roleCounts = countBy(rows, r => r.operationalRole || "(no role)");
  for (const [role, count] of roleCounts) wsRoles.addRow({ role, count });

  // ── Sheet 4: Data Issues ────────────────────────────────────────────────
  const wsIssues = wb.addWorksheet("Data Issues");
  wsIssues.columns = [
    { header: "Issue",       key: "issue",  width: 35 },
    { header: "Employee ID", key: "empId",  width: 28 },
    { header: "Name",        key: "name",   width: 28 },
    { header: "Detail",      key: "detail", width: 40 },
  ];
  wsIssues.getRow(1).font = { bold: true };
  wsIssues.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE0E0" } };

  for (const row of rows) {
    if (!row.email) {
      wsIssues.addRow({ issue: "Missing email", empId: row.employeeId, name: row.fullName, detail: "" });
    }
    if (!row.reportingManagerName && !row.managerId) {
      wsIssues.addRow({ issue: "No manager assigned", empId: row.employeeId, name: row.fullName, detail: "" });
    }
    if (!row.zoneName) {
      wsIssues.addRow({ issue: "No zone resolved", empId: row.employeeId, name: row.fullName, detail: `officeZoneId: ${row.officeZoneId}` });
    }
  }

  await wb.xlsx.writeFile(XLSX_PATH);
}

// ── Quality analysis ───────────────────────────────────────────────────────
function analyseQuality(rows) {
  const missingEmail   = rows.filter(r => !r.email);
  const missingManager = rows.filter(r => !r.reportingManagerName && !r.managerId);
  const missingZone    = rows.filter(r => !r.zoneName);
  const missingName    = rows.filter(r => !r.fullName);
  const dupEmails      = findDuplicates(rows.filter(r => r.email), r => r.email);
  const dupIds         = findDuplicates(rows, r => r.employeeId);

  return { missingEmail, missingManager, missingZone, missingName, dupEmails, dupIds };
}

// ── Markdown summary builder ───────────────────────────────────────────────
function buildSummary(rows, issues, zones, teams, hierarchyRoles) {
  const active   = rows.filter(r => (r.status ?? "").toLowerCase() === "active").length;
  const inactive = rows.filter(r => (r.status ?? "").toLowerCase() !== "active" && r.status !== "").length;
  const noStatus = rows.filter(r => !r.status).length;

  const lines = [];
  lines.push("# Legacy HRMS Workforce Export — Migration Summary");
  lines.push(`\n**Generated:** ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`);
  lines.push(`**Source:** \`gharpayy-attendance.gpattusers\``);
  lines.push(`**Status:** ✅ READ-ONLY — no data modified`);
  lines.push(`\n> ⚠️ Awaiting HR verification and approval before migration.\n`);

  lines.push("## Counts\n");
  lines.push(`| Metric | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Total employees | ${rows.length} |`);
  lines.push(`| Active | ${active} |`);
  lines.push(`| Inactive / other | ${inactive} |`);
  lines.push(`| Status blank | ${noStatus} |`);
  lines.push(`| Zones resolved | ${zones.length} |`);
  lines.push(`| Teams resolved | ${teams.length} |`);
  lines.push(`| Hierarchy roles | ${hierarchyRoles.length} |`);
  lines.push("");

  lines.push("## Role Breakdown\n");
  lines.push("| Operational Role | Count |");
  lines.push("|---|---|");
  for (const [r, n] of countBy(rows, r => r.operationalRole || "(blank)")) {
    lines.push(`| ${r} | ${n} |`);
  }
  lines.push("");

  lines.push("## App Role Breakdown\n");
  lines.push("| App Role | Count |");
  lines.push("|---|---|");
  for (const [r, n] of countBy(rows, r => r.appRole || "(blank)")) {
    lines.push(`| ${r} | ${n} |`);
  }
  lines.push("");

  lines.push("## Zone Breakdown\n");
  lines.push("| Zone | Count |");
  lines.push("|---|---|");
  for (const [z, n] of countBy(rows, r => r.zoneName || "(no zone)")) {
    lines.push(`| ${z} | ${n} |`);
  }
  lines.push("");

  lines.push("## Manager Breakdown\n");
  lines.push("| Manager | Direct Reports |");
  lines.push("|---|---|");
  for (const [m, n] of countBy(rows.filter(r => r.reportingManagerName), r => r.reportingManagerName)) {
    lines.push(`| ${m} | ${n} |`);
  }
  lines.push("");

  lines.push("## Data Quality Issues\n");
  lines.push(`| Issue | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Missing email | ${issues.missingEmail.length} |`);
  lines.push(`| Missing manager | ${issues.missingManager.length} |`);
  lines.push(`| Missing zone | ${issues.missingZone.length} |`);
  lines.push(`| Missing name | ${issues.missingName.length} |`);
  lines.push(`| Duplicate emails | ${issues.dupEmails.length} |`);
  lines.push(`| Duplicate employee IDs | ${issues.dupIds.length} |`);
  lines.push("");

  if (issues.missingEmail.length > 0) {
    lines.push("### Employees Missing Email\n");
    lines.push("| Employee ID | Name |");
    lines.push("|---|---|");
    for (const r of issues.missingEmail) {
      lines.push(`| \`${r.employeeId}\` | ${r.fullName} |`);
    }
    lines.push("");
  }

  if (issues.dupEmails.length > 0) {
    lines.push("### Duplicate Emails\n");
    lines.push("| Email | Count |");
    lines.push("|---|---|");
    for (const d of issues.dupEmails) {
      lines.push(`| ${d.value} | ${d.count} |`);
    }
    lines.push("");
  }

  if (issues.dupIds.length > 0) {
    lines.push("### Duplicate Employee IDs\n");
    lines.push("| Employee ID | Count |");
    lines.push("|---|---|");
    for (const d of issues.dupIds) {
      lines.push(`| \`${d.value}\` | ${d.count} |`);
    }
    lines.push("");
  }

  lines.push("## Output Files\n");
  lines.push(`| File | Path |`);
  lines.push(`|---|---|`);
  lines.push(`| CSV | \`exports/legacy-employees.csv\` |`);
  lines.push(`| XLSX | \`exports/legacy-employees.xlsx\` |`);
  lines.push(`| Summary | \`exports/migration-summary.md\` |`);
  lines.push("");

  lines.push("## Sample Records (first 10)\n");
  lines.push("| # | Name | Email | Role | Zone | Manager | Status |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const [i, r] of rows.slice(0, 10).entries()) {
    lines.push(`| ${i + 1} | ${r.fullName} | ${r.email || "—"} | ${r.operationalRole} | ${r.zoneName || "—"} | ${r.reportingManagerName || "—"} | ${r.status || "—"} |`);
  }
  lines.push("");

  lines.push("---");
  lines.push("\n> **Next step:** HR team reviews and approves this export before any migration is executed.");
  lines.push("> No data has been written, modified, or deleted in any database.");

  return lines.join("\n");
}

// ── Console final report ───────────────────────────────────────────────────
function printFinalReport(rows, issues) {
  const SEP = "═".repeat(64);
  console.log("\n" + SEP);
  console.log("  EXPORT COMPLETE");
  console.log(SEP);
  console.log(`\n  Total employees exported:  ${rows.length}`);
  console.log(`  Missing email:             ${issues.missingEmail.length}`);
  console.log(`  Missing manager:           ${issues.missingManager.length}`);
  console.log(`  Missing zone:              ${issues.missingZone.length}`);
  console.log(`  Duplicate emails:          ${issues.dupEmails.length}`);
  console.log(`  Duplicate IDs:             ${issues.dupIds.length}`);

  console.log("\n  Output files:");
  console.log(`    CSV:     ${CSV_PATH}`);
  console.log(`    XLSX:    ${XLSX_PATH}`);
  console.log(`    Summary: ${MD_PATH}`);

  console.log("\n  Sample records (first 10):");
  console.log("  " + "─".repeat(100));
  const pad = (s, n) => String(s ?? "").slice(0, n - 1).padEnd(n);
  console.log(
    "  " +
    [pad("#", 4), pad("Name", 26), pad("Email", 30), pad("Role", 22), pad("Zone", 20), pad("Status", 12)]
      .join(" ")
  );
  console.log("  " + "─".repeat(100));
  for (const [i, r] of rows.slice(0, 10).entries()) {
    console.log(
      "  " +
      [
        pad(i + 1, 4),
        pad(r.fullName, 26),
        pad(r.email, 30),
        pad(r.operationalRole, 22),
        pad(r.zoneName, 20),
        pad(r.status, 12),
      ].join(" ")
    );
  }

  console.log("\n" + SEP);
  console.log("  ✅ READ-ONLY — NO DATA MODIFIED");
  console.log("  ⏸  AWAITING HR APPROVAL BEFORE MIGRATION");
  console.log(SEP + "\n");
}

main().catch(err => {
  console.error("\n❌ Unhandled error:", err);
  process.exit(1);
});
