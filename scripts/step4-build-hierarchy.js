/**
 * Step 4 — Build hierarchy-enriched XLSX from raw-hierarchy.txt.
 * READ ONLY — no database connections, no writes to MongoDB.
 *
 * Run: node scripts/step4-build-hierarchy.js
 */

import { readFileSync } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const RAW_FILE  = join(ROOT, "exports", "raw-hierarchy.txt");
const XLSX_PATH = join(ROOT, "exports", "legacy-employees-with-hierarchy.xlsx");

// ── Helpers ────────────────────────────────────────────────────────────────
function safe(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v.$oid)  return v.$oid;
  if (typeof v === "object" && v.$date) return new Date(v.$date).toISOString().slice(0, 10);
  if (typeof v === "object")            return JSON.stringify(v);
  return String(v);
}

// ── Parse raw-hierarchy.txt ────────────────────────────────────────────────
function parseRawHierarchy(filePath) {
  const text  = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);

  const collections = {
    gpattusers:         [],
    gp_teams:           [],
    gp_hierarchy_roles: [],
    gpofficezones:      [],
  };

  for (const line of lines) {
    if (!line.startsWith("DOC:")) continue;
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

// ── Arena role mappers ─────────────────────────────────────────────────────
function resolveArenaAppRole(emp) {
  const role       = (emp.role       ?? "").toLowerCase();
  const systemRole = (emp.systemRole ?? "").toLowerCase();

  if (role === "manager")          return "manager";
  if (systemRole === "admin")      return "admin";
  if (systemRole === "hr")         return "hr";
  if (systemRole === "manager")    return "manager";
  if (systemRole === "team_lead")  return "manager";
  return "employee";
}

function resolveArenaOperationalRole(emp) {
  const jobRole      = (emp.jobRole      ?? "").toLowerCase();
  const playbookRole = (emp.playbookRole ?? "").toLowerCase();
  const combined     = jobRole || playbookRole;

  if (combined === "intern")                          return "Operator";
  if (combined === "full-time")                       return "Operator";
  if (combined === "manager")                         return "Floor Lead";
  if (combined === "hr")                              return "HR";
  if (combined === "team_lead" || combined === "team-lead") return "Floor Lead";
  if (combined === "admin")                           return "Admin";
  if (combined === "recruiter")                       return "Recruiter";
  return emp.jobRole || combined || "";
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  LEGACY HRMS HIERARCHY BUILDER — READ ONLY                  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // 1. Parse
  console.log("📂 Parsing raw-hierarchy.txt...");
  const { gpattusers, gp_teams, gp_hierarchy_roles, gpofficezones } = parseRawHierarchy(RAW_FILE);

  console.log(`   gpattusers:         ${gpattusers.length}`);
  console.log(`   gp_teams:           ${gp_teams.length}`);
  console.log(`   gp_hierarchy_roles: ${gp_hierarchy_roles.length}`);
  console.log(`   gpofficezones:      ${gpofficezones.length}`);

  // 2. Build lookup maps
  const zoneById          = new Map(gpofficezones.map(z => [safe(z._id), z]));
  const teamById          = new Map(gp_teams.map(t => [safe(t._id), t]));
  const hierarchyRoleById = new Map(gp_hierarchy_roles.map(r => [safe(r._id), r]));
  const empById           = new Map(gpattusers.map(e => [safe(e._id), e]));

  // Build a set of manager IDs (employees who manage a team)
  // key: empId → team doc
  const managedTeamByEmpId = new Map();
  for (const team of gp_teams) {
    const mgrId = safe(team.managerId);
    if (mgrId) managedTeamByEmpId.set(mgrId, team);
  }

  // 3. Enrich records
  console.log("\n🔗 Enriching records...");

  const enriched = gpattusers.map(emp => {
    const empId = safe(emp._id);

    // Team
    const teamIdStr = safe(emp.teamId);
    const teamDoc   = teamById.get(teamIdStr);
    const teamName  = emp.teamName || teamDoc?.name || teamDoc?.slug || "";

    // Is team manager?
    const managedTeam    = managedTeamByEmpId.get(empId);
    const isTeamManager  = !!managedTeam;
    const managedTeamName = managedTeam ? (managedTeam.name || managedTeam.slug || "") : "";

    // Reporting manager
    const reportingManagerId = safe(emp.managerId);
    const managerDoc         = reportingManagerId ? empById.get(reportingManagerId) : null;
    const reportingManagerName  = managerDoc ? (managerDoc.fullName || managerDoc.name || "") : "";
    const reportingManagerEmail = managerDoc ? (managerDoc.email || "") : "";

    // Zone
    const zoneIdStr = safe(emp.officeZoneId);
    const zoneDoc   = zoneById.get(zoneIdStr);
    const zoneName  = zoneDoc
      ? (zoneDoc.name || zoneDoc.zoneName || "")
      : (!zoneIdStr ? (emp.teamName || "") : "");  // fallback: teamName as zone hint
    const zoneShift = zoneDoc
      ? `${zoneDoc.shiftStart || ""}${zoneDoc.shiftEnd ? "-" + zoneDoc.shiftEnd : ""}`
      : "";

    // Roles
    const operationalRole  = emp.jobRole || emp.role || "";
    const playbookRole     = emp.playbookRole || "";
    const systemRole       = emp.systemRole || "";
    const hierarchyRoleDoc = hierarchyRoleById.get(safe(emp.hierarchyRoleId));
    const hierarchyRoleName = hierarchyRoleDoc
      ? (hierarchyRoleDoc.name || hierarchyRoleDoc.slug || "")
      : "";

    const arenaAppRole          = resolveArenaAppRole(emp);
    const arenaOperationalRole  = resolveArenaOperationalRole(emp);

    // Status
    const status = emp.status ?? (emp.isApproved === true ? "active" : emp.isApproved === false ? "pending" : "");

    return {
      // Identity
      legacyId:    empId,
      fullName:    emp.fullName || emp.name || "",
      email:       emp.email || "",
      phone:       emp.phone || emp.mobile || "",

      // Roles
      jobRoleLegacy:         emp.jobRole || emp.role || "",
      playbookRole,
      systemRole,
      hierarchyRoleName,
      arenaOperationalRole,
      arenaAppRole,

      // Team
      teamId:          teamIdStr,
      teamName,
      isTeamManager,
      managedTeamName,

      // Manager
      reportingManagerId,
      reportingManagerName,
      reportingManagerEmail,

      // Zone
      zoneId:    zoneIdStr,
      zoneName,
      zoneShift,

      // Misc
      status:      safe(status),
      isApproved:  emp.isApproved !== undefined ? String(emp.isApproved) : "",
      dateOfBirth: emp.dateOfBirth ? safe(emp.dateOfBirth) : "",
      createdAt:   emp.createdAt  ? safe(emp.createdAt)   : "",

      // Raw refs for unresolved sheet
      _officeZoneId: zoneIdStr,
      _managerId:    reportingManagerId,
    };
  });

  console.log(`   Enriched ${enriched.length} records`);

  // 4. Write XLSX
  console.log("\n📊 Writing XLSX...");
  await writeXLSX(enriched, gp_teams, gpofficezones);
  console.log(`   ✅ ${XLSX_PATH}`);

  // 5. Console report
  printReport(enriched);
}

// ── XLSX writer ────────────────────────────────────────────────────────────
async function writeXLSX(rows, gp_teams, gpofficezones) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Arena Legacy Hierarchy Export";
  wb.created = new Date();

  // ── Sheet 1: Employees with Hierarchy ─────────────────────────────────
  const ws1 = wb.addWorksheet("Employees with Hierarchy", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws1.columns = [
    { header: "Legacy ID",               key: "legacyId",              width: 28 },
    { header: "Full Name",               key: "fullName",              width: 26 },
    { header: "Email",                   key: "email",                 width: 30 },
    { header: "Phone",                   key: "phone",                 width: 16 },
    { header: "Job Role (Legacy)",        key: "jobRoleLegacy",         width: 18 },
    { header: "Playbook Role",           key: "playbookRole",          width: 18 },
    { header: "System Role",             key: "systemRole",            width: 16 },
    { header: "Hierarchy Role",          key: "hierarchyRoleName",     width: 20 },
    { header: "Arena Operational Role",  key: "arenaOperationalRole",  width: 22 },
    { header: "Arena App Role",          key: "arenaAppRole",          width: 16 },
    { header: "Team ID",                 key: "teamId",                width: 28 },
    { header: "Team Name",               key: "teamName",              width: 22 },
    { header: "Is Team Manager",         key: "isTeamManager",         width: 16 },
    { header: "Managed Team",            key: "managedTeamName",       width: 22 },
    { header: "Manager ID",              key: "reportingManagerId",    width: 28 },
    { header: "Reporting Manager Name",  key: "reportingManagerName",  width: 26 },
    { header: "Reporting Manager Email", key: "reportingManagerEmail", width: 30 },
    { header: "Zone ID",                 key: "zoneId",                width: 28 },
    { header: "Zone Name",               key: "zoneName",              width: 22 },
    { header: "Zone Shift",              key: "zoneShift",             width: 16 },
    { header: "Status",                  key: "status",                width: 12 },
    { header: "Is Approved",             key: "isApproved",            width: 12 },
    { header: "Date of Birth",           key: "dateOfBirth",           width: 14 },
    { header: "Created Date",            key: "createdAt",             width: 14 },
  ];

  // Header styling: bold, dark blue bg, white text
  ws1.getRow(1).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
  });

  for (const row of rows) {
    const wsRow = ws1.addRow({
      legacyId:              row.legacyId,
      fullName:              row.fullName,
      email:                 row.email,
      phone:                 row.phone,
      jobRoleLegacy:         row.jobRoleLegacy,
      playbookRole:          row.playbookRole,
      systemRole:            row.systemRole,
      hierarchyRoleName:     row.hierarchyRoleName,
      arenaOperationalRole:  row.arenaOperationalRole,
      arenaAppRole:          row.arenaAppRole,
      teamId:                row.teamId,
      teamName:              row.teamName,
      isTeamManager:         String(row.isTeamManager),
      managedTeamName:       row.managedTeamName,
      reportingManagerId:    row.reportingManagerId,
      reportingManagerName:  row.reportingManagerName,
      reportingManagerEmail: row.reportingManagerEmail,
      zoneId:                row.zoneId,
      zoneName:              row.zoneName,
      zoneShift:             row.zoneShift,
      status:                row.status,
      isApproved:            row.isApproved,
      dateOfBirth:           row.dateOfBirth,
      createdAt:             row.createdAt,
    });

    // Row coloring rules (applied in priority order — last wins if multiple match)
    if (!row.zoneName) {
      wsRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFF0" } };
      });
    }
    if (!row.reportingManagerName && !row._managerId) {
      wsRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
      });
    }
    if (row.isTeamManager) {
      wsRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
      });
    }
  }

  ws1.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: ws1.columns.length },
  };

  // ── Sheet 2: Manager Hierarchy Tree ───────────────────────────────────
  const ws2 = wb.addWorksheet("Manager Hierarchy Tree");
  ws2.columns = [
    { header: "Manager Name",       key: "managerName",    width: 26 },
    { header: "Manager Email",      key: "managerEmail",   width: 30 },
    { header: "Manager Role",       key: "managerRole",    width: 20 },
    { header: "Team Name",          key: "teamName",       width: 22 },
    { header: "Direct Reports",     key: "directReports",  width: 16 },
    { header: "Report Names",       key: "reportNames",    width: 60 },
  ];

  ws2.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B5E20" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const managers = rows.filter(r => r.isTeamManager);
  for (const mgr of managers) {
    const directReports = rows.filter(r => r.reportingManagerId === mgr.legacyId);
    ws2.addRow({
      managerName:   mgr.fullName,
      managerEmail:  mgr.email,
      managerRole:   mgr.arenaOperationalRole || mgr.jobRoleLegacy,
      teamName:      mgr.managedTeamName,
      directReports: directReports.length,
      reportNames:   directReports.map(r => r.fullName).join("; "),
    });
  }

  // ── Sheet 3: Team Roster ───────────────────────────────────────────────
  const ws3 = wb.addWorksheet("Team Roster");
  ws3.columns = [
    { header: "Team Name",    key: "teamName",    width: 24 },
    { header: "Team ID",      key: "teamId",      width: 28 },
    { header: "Manager Name", key: "managerName", width: 26 },
    { header: "Manager Email",key: "managerEmail",width: 30 },
    { header: "Member Count", key: "memberCount", width: 14 },
    { header: "Members",      key: "members",     width: 70 },
  ];
  ws3.getRow(1).font = { bold: true };

  // Group employees by team
  const teamMap = new Map(); // teamId → { name, members[] }
  for (const row of rows) {
    const key = row.teamId || row.teamName || "(no team)";
    if (!teamMap.has(key)) {
      teamMap.set(key, { teamName: row.teamName || "(no team)", teamId: row.teamId, members: [] });
    }
    teamMap.get(key).members.push(row);
  }

  for (const [, team] of teamMap) {
    const mgrRow = team.members.find(m => m.isTeamManager) ||
                   team.members.find(m => m.reportingManagerId === "");
    ws3.addRow({
      teamName:    team.teamName,
      teamId:      team.teamId,
      managerName: mgrRow?.fullName || "",
      managerEmail:mgrRow?.email    || "",
      memberCount: team.members.length,
      members:     team.members.map(m => m.fullName).join("; "),
    });
  }

  // ── Sheet 4: Zone Roster ───────────────────────────────────────────────
  const ws4 = wb.addWorksheet("Zone Roster");
  ws4.columns = [
    { header: "Zone Name",      key: "zoneName",     width: 24 },
    { header: "Zone ID",        key: "zoneId",       width: 28 },
    { header: "Shift",          key: "shift",        width: 16 },
    { header: "Week Off",       key: "weekOff",      width: 14 },
    { header: "Employee Count", key: "empCount",     width: 16 },
    { header: "Employees",      key: "employees",    width: 70 },
  ];
  ws4.getRow(1).font = { bold: true };

  // Group by zone
  const zoneMap = new Map();
  for (const row of rows) {
    const key = row.zoneId || row.zoneName || "(no zone)";
    if (!zoneMap.has(key)) {
      // Find zone doc for shift/weekOff
      const zDoc = gpofficezones.find(z => safe(z._id) === row.zoneId);
      zoneMap.set(key, {
        zoneName: row.zoneName || "(no zone)",
        zoneId:   row.zoneId,
        shift:    row.zoneShift,
        weekOff:  zDoc?.weekOffDay || "",
        members:  [],
      });
    }
    zoneMap.get(key).members.push(row);
  }

  for (const [, zone] of zoneMap) {
    ws4.addRow({
      zoneName:  zone.zoneName,
      zoneId:    zone.zoneId,
      shift:     zone.shift,
      weekOff:   zone.weekOff,
      empCount:  zone.members.length,
      employees: zone.members.map(m => m.fullName).join("; "),
    });
  }

  // ── Sheet 5: Role Mapping ──────────────────────────────────────────────
  const ws5 = wb.addWorksheet("Role Mapping");
  ws5.columns = [
    { header: "Legacy Role",             key: "legacyRole",    width: 18 },
    { header: "Legacy Job Role",         key: "legacyJobRole", width: 18 },
    { header: "Legacy Playbook Role",    key: "playbookRole",  width: 20 },
    { header: "Legacy System Role",      key: "systemRole",    width: 18 },
    { header: "→ Arena Operational Role",key: "arenaOp",       width: 24 },
    { header: "→ Arena App Role",        key: "arenaApp",      width: 18 },
    { header: "Count",                   key: "count",         width: 10 },
  ];

  ws5.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE65100" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Group by unique combination
  const roleCombos = new Map();
  for (const row of rows) {
    const key = [
      row.jobRoleLegacy,
      row.jobRoleLegacy,
      row.playbookRole,
      row.systemRole,
      row.arenaOperationalRole,
      row.arenaAppRole,
    ].join("|");
    if (!roleCombos.has(key)) {
      roleCombos.set(key, {
        legacyRole:    row.jobRoleLegacy,
        legacyJobRole: row.jobRoleLegacy,
        playbookRole:  row.playbookRole,
        systemRole:    row.systemRole,
        arenaOp:       row.arenaOperationalRole,
        arenaApp:      row.arenaAppRole,
        count:         0,
      });
    }
    roleCombos.get(key).count++;
  }

  const sortedCombos = [...roleCombos.values()].sort((a, b) => b.count - a.count);
  for (const combo of sortedCombos) {
    ws5.addRow(combo);
  }

  // ── Sheet 6: Unresolved ────────────────────────────────────────────────
  const ws6 = wb.addWorksheet("Unresolved");
  ws6.columns = [
    { header: "Issue",       key: "issue",  width: 24 },
    { header: "Employee ID", key: "empId",  width: 28 },
    { header: "Name",        key: "name",   width: 26 },
    { header: "Email",       key: "email",  width: 30 },
    { header: "Detail",      key: "detail", width: 40 },
  ];

  ws6.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB71C1C" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  for (const row of rows) {
    if (!row.zoneName) {
      ws6.addRow({
        issue:  "No zone resolved",
        empId:  row.legacyId,
        name:   row.fullName,
        email:  row.email,
        detail: `officeZoneId: ${row._officeZoneId || "(blank)"}`,
      });
    }
    if (!row.teamName) {
      ws6.addRow({
        issue:  "No team resolved",
        empId:  row.legacyId,
        name:   row.fullName,
        email:  row.email,
        detail: `teamId: ${row.teamId || "(blank)"}`,
      });
    }
    if (!row.reportingManagerName && !row._managerId) {
      ws6.addRow({
        issue:  "No manager assigned",
        empId:  row.legacyId,
        name:   row.fullName,
        email:  row.email,
        detail: "managerId is blank",
      });
    }
  }

  await wb.xlsx.writeFile(XLSX_PATH);
}

// ── Console report ─────────────────────────────────────────────────────────
function printReport(rows) {
  const SEP = "═".repeat(72);

  console.log("\n" + SEP);
  console.log("  HIERARCHY EXPORT COMPLETE");
  console.log(SEP);

  console.log(`\n  Total employees: ${rows.length}`);

  // Team breakdown
  const teamCounts = {};
  for (const r of rows) {
    const k = r.teamName || "(no team)";
    teamCounts[k] = (teamCounts[k] ?? 0) + 1;
  }
  console.log("\n  Team breakdown:");
  for (const [team, count] of Object.entries(teamCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${team}: ${count}`);
  }

  // Zone breakdown
  const zoneCounts = {};
  for (const r of rows) {
    const k = r.zoneName || "(no zone)";
    zoneCounts[k] = (zoneCounts[k] ?? 0) + 1;
  }
  console.log("\n  Zone breakdown:");
  for (const [zone, count] of Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${zone}: ${count}`);
  }

  // Manager list
  const managers = rows.filter(r => r.isTeamManager);
  console.log("\n  Managers:");
  for (const mgr of managers) {
    const directCount = rows.filter(r => r.reportingManagerId === mgr.legacyId).length;
    console.log(`    ${mgr.fullName} → ${mgr.managedTeamName} → ${directCount} direct reports`);
  }

  // Unresolved counts
  const noZone    = rows.filter(r => !r.zoneName).length;
  const noTeam    = rows.filter(r => !r.teamName).length;
  const noManager = rows.filter(r => !r.reportingManagerName && !r._managerId).length;

  console.log("\n  Unresolved:");
  console.log(`    No zone:    ${noZone}`);
  console.log(`    No team:    ${noTeam}`);
  console.log(`    No manager: ${noManager}`);

  console.log(`\n  Output: ${XLSX_PATH}`);
  console.log("\n" + SEP);
  console.log("  ✅ READ-ONLY — NO DATA MODIFIED");
  console.log(SEP + "\n");
}

main().catch(err => {
  console.error("\n❌ Error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
