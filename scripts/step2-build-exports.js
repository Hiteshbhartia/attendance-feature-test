/**
 * Step 2 — Build CSV, XLSX, and summary MD from the raw mongosh extract.
 * READ ONLY — no database connections, no writes to MongoDB.
 *
 * Run: node scripts/step2-build-exports.js
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const EXPORTS   = join(ROOT, "exports");
const RAW_FILE  = join(EXPORTS, "raw-extract.txt");

mkdirSync(EXPORTS, { recursive: true });

const CSV_PATH  = join(EXPORTS, "legacy-employees.csv");
const XLSX_PATH = join(EXPORTS, "legacy-employees.xlsx");
const MD_PATH   = join(EXPORTS, "migration-summary.md");

// ── Column definitions ─────────────────────────────────────────────────────
const COLUMNS = [
  { key: "employeeId",            header: "Employee ID" },
  { key: "fullName",              header: "Full Name" },
  { key: "email",                 header: "Email" },
  { key: "phone",                 header: "Phone" },
  { key: "operationalRole",       header: "Operational Role" },
  { key: "appRole",               header: "Application Role" },
  { key: "designation",           header: "Designation / Job Role" },
  { key: "zoneName",              header: "Zone" },
  { key: "teamName",              header: "Team / Squad" },
  { key: "reportingManagerName",  header: "Reporting Manager" },
  { key: "reportingManagerEmail", header: "Reporting Manager Email" },
  { key: "status",                header: "Status" },
  { key: "isApproved",            header: "Is Approved" },
  { key: "dateOfBirth",           header: "Date of Birth" },
  { key: "officeZoneId",          header: "Office Zone ID (raw)" },
  { key: "teamId",                header: "Team ID (raw)" },
  { key: "managerId",             header: "Manager ID (raw)" },
  { key: "createdAt",             header: "Created Date" },
  { key: "updatedAt",             header: "Updated Date" },
  { key: "sourceId",              header: "Legacy _id" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function safe(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v.$oid)  return v.$oid;
  if (typeof v === "object" && v.$date) return new Date(v.$date).toISOString().slice(0, 10);
  if (typeof v === "object")            return JSON.stringify(v);
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
  for (const x of arr) {
    const k = safe(fn(x));
    if (!k) continue;
    seen[k] = (seen[k] ?? 0) + 1;
  }
  return Object.entries(seen)
    .filter(([, n]) => n > 1)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Parse raw extract file ─────────────────────────────────────────────────
function parseRawExtract(filePath) {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);

  const collections = {
    gpattusers:        [],
    gp_teams:          [],
    gp_hierarchy_roles:[],
    gpofficezones:     [],
  };

  for (const line of lines) {
    if (!line.startsWith("DOC:")) continue;
    // Format: DOC:<collection>:<json>
    const firstColon  = line.indexOf(":");
    const secondColon = line.indexOf(":", firstColon + 1);
    const colName     = line.slice(firstColon + 1, secondColon);
    const jsonStr     = line.slice(secondColon + 1);

    if (!collections[colName]) continue;
    try {
      const doc = JSON.parse(jsonStr);
      collections[colName].push(doc);
    } catch (e) {
      console.warn(`  ⚠️  Could not parse doc in ${colName}: ${e.message.slice(0, 80)}`);
    }
  }

  return collections;
}

// ── Role inference ─────────────────────────────────────────────────────────
function resolveAppRole(emp, roleRecord) {
  if (emp.appRole) return emp.appRole;
  if (roleRecord) {
    if (roleRecord.systemRole === "admin" || roleRecord.level === 1) return "admin";
    if (roleRecord.canManageTeam) return "manager";
    return "employee";
  }
  const r = (emp.role ?? emp.jobRole ?? "").toLowerCase();
  if (r.includes("admin") || r.includes("super"))                          return "admin";
  if (r.includes("manager") || r.includes("lead") || r.includes("zone") ||
      r.includes("head") || r.includes("hr"))                              return "manager";
  return "employee";
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  LEGACY HRMS EXPORT BUILDER — READ ONLY                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ── 1. Parse raw extract ─────────────────────────────────────────────────
  console.log("📂 Parsing raw extract...");
  const { gpattusers, gp_teams, gp_hierarchy_roles, gpofficezones } = parseRawExtract(RAW_FILE);

  console.log(`   gpattusers:         ${gpattusers.length}`);
  console.log(`   gp_teams:           ${gp_teams.length}`);
  console.log(`   gp_hierarchy_roles: ${gp_hierarchy_roles.length}`);
  console.log(`   gpofficezones:      ${gpofficezones.length}`);

  // ── 2. Build lookup maps ─────────────────────────────────────────────────
  const zoneById   = new Map(gpofficezones.map(z => [safe(z._id), z]));
  const teamById   = new Map(gp_teams.map(t => [safe(t._id), t]));
  const roleBySlug = new Map(gp_hierarchy_roles.map(r => [r.slug ?? r.name, r]));
  const empById    = new Map(gpattusers.map(e => [safe(e._id), e]));

  // ── 3. Enrich records ────────────────────────────────────────────────────
  console.log("\n🔗 Enriching records...");

  const enriched = gpattusers.map(emp => {
    const empIdStr = safe(emp._id);

    // Zone
    const zoneIdStr = safe(emp.officeZoneId);
    const zone      = zoneById.get(zoneIdStr);
    const zoneName  = zone?.name ?? zone?.zoneName ?? "";

    // Team — find team where managerId matches this employee
    const team     = gp_teams.find(t => safe(t.managerId) === empIdStr);
    const teamName = team?.name ?? team?.slug ?? "";
    const teamId   = team ? safe(team._id) : "";

    // Manager
    const rawManagerId = emp.managerId ?? emp.reportingTo ?? emp.reportsTo ?? null;
    const managerIdStr = rawManagerId ? safe(rawManagerId) : "";
    const manager      = managerIdStr ? empById.get(managerIdStr) : null;
    const reportingManagerName  = manager?.fullName ?? manager?.name ?? "";
    const reportingManagerEmail = manager?.email ?? "";

    // Role
    const operationalRole = emp.role ?? emp.jobRole ?? emp.designation ?? "";
    const roleRecord      = roleBySlug.get(operationalRole);
    const appRole         = resolveAppRole(emp, roleRecord);

    // Status
    const status = emp.status ?? (emp.isApproved === true ? "active" : emp.isApproved === false ? "pending" : "");

    return {
      employeeId:            empIdStr,
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
      isApproved:            emp.isApproved !== undefined ? String(emp.isApproved) : "",
      dateOfBirth:           emp.dateOfBirth ? safe(emp.dateOfBirth) : "",
      // profilePhoto intentionally excluded — base64 data URLs are too large for CSV/XLSX
      officeZoneId:          zoneIdStr,
      teamId,
      managerId:             managerIdStr,
      createdAt:             emp.createdAt ? safe(emp.createdAt) : "",
      updatedAt:             emp.updatedAt ? safe(emp.updatedAt) : "",
      sourceId:              empIdStr,
    };
  });

  console.log(`   Enriched ${enriched.length} records`);

  // ── 4. Write CSV ─────────────────────────────────────────────────────────
  console.log("\n📄 Writing CSV...");
  const header = COLUMNS.map(c => csvEscape(c.header)).join(",");
  const lines  = [header, ...enriched.map(row =>
    COLUMNS.map(c => csvEscape(row[c.key])).join(",")
  )];
  writeFileSync(CSV_PATH, lines.join("\n"), "utf8");
  console.log(`   ✅ ${CSV_PATH}`);

  // ── 5. Write XLSX ────────────────────────────────────────────────────────
  console.log("\n📊 Writing XLSX...");
  await writeXLSX(enriched, gpofficezones, gp_teams, gp_hierarchy_roles);
  console.log(`   ✅ ${XLSX_PATH}`);

  // ── 6. Quality analysis ──────────────────────────────────────────────────
  console.log("\n🔍 Analysing data quality...");
  const issues = {
    missingEmail:   enriched.filter(r => !r.email),
    missingManager: enriched.filter(r => !r.reportingManagerName && !r.managerId),
    missingZone:    enriched.filter(r => !r.zoneName),
    missingName:    enriched.filter(r => !r.fullName),
    dupEmails:      findDuplicates(enriched.filter(r => r.email), r => r.email),
    dupIds:         findDuplicates(enriched, r => r.employeeId),
  };

  // ── 7. Write summary MD ──────────────────────────────────────────────────
  console.log("\n📝 Writing summary...");
  const md = buildSummary(enriched, issues, gpofficezones, gp_teams, gp_hierarchy_roles);
  await writeFile(MD_PATH, md, "utf8");
  console.log(`   ✅ ${MD_PATH}`);

  // ── 8. Console report ────────────────────────────────────────────────────
  printReport(enriched, issues);
}

// ── XLSX writer ────────────────────────────────────────────────────────────
async function writeXLSX(rows, zones, teams, hroles) {
  const wb = new ExcelJS.Workbook();
  wb.creator  = "Arena Legacy Export";
  wb.created  = new Date();

  // Sheet 1: Employees
  const ws = wb.addWorksheet("Employees", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map(c => ({
    header: c.header,
    key:    c.key,
    width:  Math.max(c.header.length + 4, 18),
  }));

  // Header styling
  ws.getRow(1).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
  });

  for (const row of rows) {
    const values = {};
    for (const col of COLUMNS) values[col.key] = safe(row[col.key]);
    const wsRow = ws.addRow(values);

    if (!row.email) {
      wsRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
      });
    }
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  // Sheet 2: Zones
  const wsZ = wb.addWorksheet("Zones");
  wsZ.columns = [
    { header: "Zone ID",    key: "id",    width: 28 },
    { header: "Zone Name",  key: "name",  width: 25 },
    { header: "Shift Start",key: "start", width: 14 },
    { header: "Shift End",  key: "end",   width: 14 },
    { header: "Week Off",   key: "off",   width: 14 },
  ];
  wsZ.getRow(1).font = { bold: true };
  for (const z of zones) {
    wsZ.addRow({ id: safe(z._id), name: z.name ?? z.zoneName ?? "", start: z.shiftStart ?? "", end: z.shiftEnd ?? "", off: z.weekOffDay ?? "" });
  }

  // Sheet 3: Teams
  const wsT = wb.addWorksheet("Teams");
  wsT.columns = [
    { header: "Team ID",    key: "id",   width: 28 },
    { header: "Name",       key: "name", width: 25 },
    { header: "Slug",       key: "slug", width: 20 },
    { header: "Manager ID", key: "mgr",  width: 28 },
    { header: "Department", key: "dept", width: 20 },
  ];
  wsT.getRow(1).font = { bold: true };
  for (const t of teams) {
    wsT.addRow({ id: safe(t._id), name: t.name ?? "", slug: t.slug ?? "", mgr: safe(t.managerId), dept: t.department ?? "" });
  }

  // Sheet 4: Hierarchy Roles
  const wsR = wb.addWorksheet("Hierarchy Roles");
  wsR.columns = [
    { header: "Name",           key: "name",   width: 25 },
    { header: "Slug",           key: "slug",   width: 20 },
    { header: "Level",          key: "level",  width: 10 },
    { header: "System Role",    key: "sys",    width: 15 },
    { header: "Can Manage Team",key: "mgmt",   width: 18 },
    { header: "Can Be Reported",key: "report", width: 18 },
  ];
  wsR.getRow(1).font = { bold: true };
  for (const r of hroles) {
    wsR.addRow({ name: r.name ?? "", slug: r.slug ?? "", level: r.level ?? "", sys: r.systemRole ?? "", mgmt: String(r.canManageTeam ?? ""), report: String(r.canBeReportedTo ?? "") });
  }

  // Sheet 5: Role Summary
  const wsRS = wb.addWorksheet("Role Summary");
  wsRS.columns = [
    { header: "Operational Role", key: "role",  width: 28 },
    { header: "Count",            key: "count", width: 10 },
  ];
  wsRS.getRow(1).font = { bold: true };
  for (const [role, count] of countBy(rows, r => r.operationalRole || "(blank)")) {
    wsRS.addRow({ role, count });
  }

  // Sheet 6: Zone Summary
  const wsZS = wb.addWorksheet("Zone Summary");
  wsZS.columns = [
    { header: "Zone",  key: "zone",  width: 28 },
    { header: "Count", key: "count", width: 10 },
  ];
  wsZS.getRow(1).font = { bold: true };
  for (const [zone, count] of countBy(rows, r => r.zoneName || "(no zone)")) {
    wsZS.addRow({ zone, count });
  }

  // Sheet 7: Data Issues
  const wsI = wb.addWorksheet("Data Issues");
  wsI.columns = [
    { header: "Issue",       key: "issue",  width: 30 },
    { header: "Employee ID", key: "empId",  width: 28 },
    { header: "Name",        key: "name",   width: 28 },
    { header: "Detail",      key: "detail", width: 35 },
  ];
  wsI.getRow(1).font = { bold: true };
  wsI.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE0E0" } };

  for (const row of rows) {
    if (!row.email)                                  wsI.addRow({ issue: "Missing email",      empId: row.employeeId, name: row.fullName, detail: "" });
    if (!row.reportingManagerName && !row.managerId) wsI.addRow({ issue: "No manager assigned", empId: row.employeeId, name: row.fullName, detail: "" });
    if (!row.zoneName)                               wsI.addRow({ issue: "No zone resolved",    empId: row.employeeId, name: row.fullName, detail: `officeZoneId: ${row.officeZoneId}` });
  }

  await wb.xlsx.writeFile(XLSX_PATH);
}

// ── Markdown summary ───────────────────────────────────────────────────────
function buildSummary(rows, issues, zones, teams, hroles) {
  const active   = rows.filter(r => (r.status ?? "").toLowerCase() === "active").length;
  const inactive = rows.filter(r => r.status && r.status.toLowerCase() !== "active").length;
  const noStatus = rows.filter(r => !r.status).length;

  const lines = [];
  lines.push("# Legacy HRMS Workforce Export — Migration Summary");
  lines.push(`\n**Generated:** ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`);
  lines.push(`**Source:** \`gharpayy-attendance.gpattusers\` (via mongosh read-only extraction)`);
  lines.push(`**Status:** ✅ READ-ONLY — no data modified\n`);
  lines.push(`> ⚠️ Awaiting HR verification and approval before migration.\n`);

  lines.push("## Counts\n");
  lines.push("| Metric | Count |");
  lines.push("|---|---|");
  lines.push(`| Total employees | **${rows.length}** |`);
  lines.push(`| Active | ${active} |`);
  lines.push(`| Inactive / other | ${inactive} |`);
  lines.push(`| Status blank | ${noStatus} |`);
  lines.push(`| Zones (reference) | ${zones.length} |`);
  lines.push(`| Teams (reference) | ${teams.length} |`);
  lines.push(`| Hierarchy roles | ${hroles.length} |`);
  lines.push("");

  lines.push("## Operational Role Breakdown\n");
  lines.push("| Role | Count |");
  lines.push("|---|---|");
  for (const [r, n] of countBy(rows, r => r.operationalRole || "(blank)")) lines.push(`| ${r} | ${n} |`);
  lines.push("");

  lines.push("## Application Role Breakdown\n");
  lines.push("| App Role | Count |");
  lines.push("|---|---|");
  for (const [r, n] of countBy(rows, r => r.appRole || "(blank)")) lines.push(`| ${r} | ${n} |`);
  lines.push("");

  lines.push("## Zone Breakdown\n");
  lines.push("| Zone | Count |");
  lines.push("|---|---|");
  for (const [z, n] of countBy(rows, r => r.zoneName || "(no zone)")) lines.push(`| ${z} | ${n} |`);
  lines.push("");

  lines.push("## Manager Breakdown\n");
  lines.push("| Manager | Direct Reports |");
  lines.push("|---|---|");
  for (const [m, n] of countBy(rows.filter(r => r.reportingManagerName), r => r.reportingManagerName)) {
    lines.push(`| ${m} | ${n} |`);
  }
  lines.push("");

  lines.push("## Hierarchy Roles (from gp_hierarchy_roles)\n");
  lines.push("| Name | Level | System Role | Can Manage Team |");
  lines.push("|---|---|---|---|");
  for (const r of hroles.sort((a, b) => (a.level ?? 99) - (b.level ?? 99))) {
    lines.push(`| ${r.name ?? r.slug ?? ""} | ${r.level ?? ""} | ${r.systemRole ?? ""} | ${r.canManageTeam ?? ""} |`);
  }
  lines.push("");

  lines.push("## Data Quality Issues\n");
  lines.push("| Issue | Count |");
  lines.push("|---|---|");
  lines.push(`| Missing email | ${issues.missingEmail.length} |`);
  lines.push(`| Missing manager | ${issues.missingManager.length} |`);
  lines.push(`| Missing zone | ${issues.missingZone.length} |`);
  lines.push(`| Missing name | ${issues.missingName.length} |`);
  lines.push(`| Duplicate emails | ${issues.dupEmails.length} |`);
  lines.push(`| Duplicate employee IDs | ${issues.dupIds.length} |`);
  lines.push("");

  if (issues.missingEmail.length > 0) {
    lines.push("### Employees Missing Email\n");
    lines.push("| # | Employee ID | Name | Role | Zone |");
    lines.push("|---|---|---|---|---|");
    issues.missingEmail.forEach((r, i) => {
      lines.push(`| ${i+1} | \`${r.employeeId}\` | ${r.fullName} | ${r.operationalRole} | ${r.zoneName || "—"} |`);
    });
    lines.push("");
  }

  if (issues.dupEmails.length > 0) {
    lines.push("### Duplicate Emails\n");
    lines.push("| Email | Count |");
    lines.push("|---|---|");
    for (const d of issues.dupEmails) lines.push(`| ${d.value} | ${d.count} |`);
    lines.push("");
  }

  if (issues.dupIds.length > 0) {
    lines.push("### Duplicate Employee IDs\n");
    lines.push("| Employee ID | Count |");
    lines.push("|---|---|");
    for (const d of issues.dupIds) lines.push(`| \`${d.value}\` | ${d.count} |`);
    lines.push("");
  }

  lines.push("## Sample Records (first 10)\n");
  lines.push("| # | Name | Email | Role | App Role | Zone | Manager | Status |");
  lines.push("|---|---|---|---|---|---|---|---|");
  rows.slice(0, 10).forEach((r, i) => {
    lines.push(`| ${i+1} | ${r.fullName || "—"} | ${r.email || "—"} | ${r.operationalRole || "—"} | ${r.appRole || "—"} | ${r.zoneName || "—"} | ${r.reportingManagerName || "—"} | ${r.status || "—"} |`);
  });
  lines.push("");

  lines.push("## Output Files\n");
  lines.push("| File | Path |");
  lines.push("|---|---|");
  lines.push("| CSV  | `exports/legacy-employees.csv` |");
  lines.push("| XLSX | `exports/legacy-employees.xlsx` |");
  lines.push("| Summary | `exports/migration-summary.md` |");
  lines.push("");
  lines.push("---");
  lines.push("\n> **Next step:** HR team reviews and approves this export before any migration is executed.");
  lines.push("> No data has been written, modified, or deleted in any database.");

  return lines.join("\n");
}

// ── Console report ─────────────────────────────────────────────────────────
function printReport(rows, issues) {
  const pad = (s, n) => String(s ?? "").slice(0, n - 1).padEnd(n);
  const SEP = "═".repeat(72);

  console.log("\n" + SEP);
  console.log("  EXPORT COMPLETE");
  console.log(SEP);
  console.log(`\n  Total employees:    ${rows.length}`);
  console.log(`  Missing email:      ${issues.missingEmail.length}`);
  console.log(`  Missing manager:    ${issues.missingManager.length}`);
  console.log(`  Missing zone:       ${issues.missingZone.length}`);
  console.log(`  Duplicate emails:   ${issues.dupEmails.length}`);
  console.log(`  Duplicate IDs:      ${issues.dupIds.length}`);

  console.log("\n  Output files:");
  console.log(`    CSV:     ${CSV_PATH}`);
  console.log(`    XLSX:    ${XLSX_PATH}`);
  console.log(`    Summary: ${MD_PATH}`);

  console.log("\n  Sample records (first 10):");
  console.log("  " + "─".repeat(110));
  console.log("  " + [pad("#",4), pad("Name",26), pad("Email",30), pad("Role",20), pad("Zone",20), pad("Status",12)].join(" "));
  console.log("  " + "─".repeat(110));
  rows.slice(0, 10).forEach((r, i) => {
    console.log("  " + [
      pad(i + 1, 4),
      pad(r.fullName, 26),
      pad(r.email, 30),
      pad(r.operationalRole, 20),
      pad(r.zoneName, 20),
      pad(r.status, 12),
    ].join(" "));
  });

  console.log("\n" + SEP);
  console.log("  ✅ READ-ONLY — NO DATA MODIFIED");
  console.log("  ⏸  AWAITING HR APPROVAL BEFORE MIGRATION");
  console.log(SEP + "\n");
}

main().catch(err => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
