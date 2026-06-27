/**
 * Step 3 — READ-ONLY hierarchy extraction.
 * Dumps all four collections with full field set (no profilePhoto/tokens).
 * mongosh <uri> --file scripts/step3-extract-hierarchy.js --norc
 * ZERO writes to any database.
 */

const OMIT = { password: 0, passwordHash: 0, profilePhoto: 0,
               activeSessionToken: 0, pinHash: 0 };

function emit(col, docs) {
  for (const d of docs) {
    print("DOC:" + col + ":" + EJSON.stringify(d));
  }
}

print("=== HIERARCHY EXTRACTION START ===");

const employees = db.gpattusers.find({}, OMIT).toArray();
print("COLLECTION:gpattusers:COUNT:" + employees.length);
emit("gpattusers", employees);

const teams = db.gp_teams.find({}).toArray();
print("COLLECTION:gp_teams:COUNT:" + teams.length);
emit("gp_teams", teams);

const hroles = db.gp_hierarchy_roles.find({}).toArray();
print("COLLECTION:gp_hierarchy_roles:COUNT:" + hroles.length);
emit("gp_hierarchy_roles", hroles);

const zones = db.gpofficezones.find({}).toArray();
print("COLLECTION:gpofficezones:COUNT:" + zones.length);
emit("gpofficezones", zones);

print("=== HIERARCHY EXTRACTION END ===");
