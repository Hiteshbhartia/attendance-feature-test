/** Legacy boot hook — DB-first mode uses syncArenaData() after auth instead. */
export function bootArena() {
  // No-op: demo data is seeded to MongoDB via POST /api/migrate/seed-demo-data
}
