import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const clientDir = join(process.cwd(), "dist", "client");
const indexPath = join(clientDir, "index.html");
const assetsDir = join(clientDir, "assets");

function fail(message) {
  console.error(`[vercel] ${message}`);
  process.exit(1);
}

if (!existsSync(indexPath) || !statSync(indexPath).isFile()) {
  fail(
    "dist/client/index.html is missing. SPA prerender did not run — check vite.config.ts tanstackStart.spa settings.",
  );
}

if (!existsSync(assetsDir) || !statSync(assetsDir).isDirectory()) {
  fail("dist/client/assets is missing. Client build output is incomplete.");
}

console.log("[vercel] dist/client/index.html and assets verified");
