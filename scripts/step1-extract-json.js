/**
 * Step 1 — READ-ONLY mongosh extraction script.
 * Dumps all four collections to JSON files in exports/raw/.
 *
 * Run:
 *   mongosh "mongodb+srv://hitesh:...@cluster0.iibqlyr.mongodb.net/gharpayy-attendance?appName=Cluster0" \
 *     --file scripts/step1-extract-json.js --norc
 *
 * ZERO writes to any database.
 */

// ── helpers ────────────────────────────────────────────────────────────────
// mongosh has no fs module — we use print() to emit JSON lines that the
// caller redirects to a file, OR we use the EJSON helper to write directly.
// We use EJSON.stringify so ObjectIds / Dates survive round-trip.

function dumpCollection(colName) {
  const docs = db.getCollection(colName)
    .find({}, { password: 0, passwordHash: 0, pinHash: 0 })
    .toArray();
  return docs;
}

print("=== EXTRACTION START ===");
print("Database: " + db.getName());

const collections = ["gpattusers", "gp_teams", "gp_hierarchy_roles", "gpofficezones"];

for (const col of collections) {
  const docs = dumpCollection(col);
  print("COLLECTION:" + col + ":COUNT:" + docs.length);
  // Emit one JSON line per document, prefixed so the builder can parse it
  for (const doc of docs) {
    print("DOC:" + col + ":" + EJSON.stringify(doc));
  }
}

print("=== EXTRACTION END ===");
