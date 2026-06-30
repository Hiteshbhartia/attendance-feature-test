import fs from "fs";
import path from "path";

const skip = new Set(["src/data/seed.ts", "src/data/demo-payload.ts"]);

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "node_modules") walk(p);
    else if (/\.(ts|tsx)$/.test(ent.name)) {
      const rel = p.replace(/\\/g, "/");
      if ([...skip].some((s) => rel.endsWith(s))) continue;
      let c = fs.readFileSync(p, "utf8");
      const orig = c;
      if (!c.includes("@/data/seed")) continue;

      const needsTeam =
        /\bteamSummary\b/.test(c) || (/\btierFor\b/.test(c) && !rel.includes("permissions.ts"));
      c = c.replace(/from "@\/data\/seed"/g, 'from "@/types/hr"');
      c = c.replace(/from '@\/data\/seed'/g, "from '@/types/hr'");

      if (needsTeam && !c.includes("@/lib/team-metrics")) {
        const m = c.match(/^import .+ from ["']@\/types\/hr["'];?\n/m);
        if (m) {
          const insert = m[0] + 'import { teamSummary, tierFor } from "@/lib/team-metrics";\n';
          c = c.replace(m[0], insert);
        } else {
          c = 'import { teamSummary, tierFor } from "@/lib/team-metrics";\n' + c;
        }
      }

      // permissions.ts uses different tierOf — only type imports
      if (rel.endsWith("permissions.ts")) {
        c = orig.replace(/from "@\/data\/seed"/g, 'from "@/types/hr"');
      }

      if (c !== orig) {
        fs.writeFileSync(p, c);
        console.log("updated", rel);
      }
    }
  }
}

walk("src");
console.log("done");
