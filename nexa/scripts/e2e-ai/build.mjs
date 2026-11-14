// น้องวีบอท end-to-end checks that need no AI key and leave no trace.
//
//   run-chat   the whole chat and confirm routes against a scripted "model" (no network); reads the real
//              database but writes nothing, and fails if any row count changed.
//   run-writes every confirm path (send, publish, shifts, quota, draft form, approvals) inside ONE
//              transaction that is thrown away at the end, with LINE and email switched off.
//
// Run both:  npm run test:ai        (needs DATABASE_URL and JWT_ACCESS_SECRET in .env.local)
// Run one:   node scripts/e2e-ai/build.mjs run-writes && node --env-file=.env.local .tmp-e2e/run-writes.cjs
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const NEXA = path.resolve(HERE, "../..");
const require = createRequire(path.join(NEXA, "package.json"));
const { build } = require("esbuild");
const entry = process.argv[2] ?? "run-chat";
await build({
  entryPoints: [path.join(HERE, `${entry}.mts`)], bundle: true, platform: "node", format: "cjs", outfile: path.join(NEXA, `.tmp-e2e/${entry}.cjs`),
  nodePaths: [path.join(NEXA, "node_modules")], external: ["@prisma/client", ".prisma/client", "server-only", "next", "next/server", "@opentelemetry/api"],
  plugins: [{ name: "alias", setup(b) {
    b.onResolve({ filter: /^next\/headers$/ }, () => ({ path: path.join(HERE, "headers-stub.mts") }));
    b.onResolve({ filter: /^next\/cache$/ }, () => ({ path: path.join(HERE, "next-cache-stub.mts") }));
    b.onResolve({ filter: /^@\/lib\/ai\/client$/ }, () => ({ path: path.join(HERE, "client-stub.mts") }));
    b.onResolve({ filter: /^@\/lib\/prisma$/ }, () => ({ path: path.join(HERE, "prisma-stub.mts") }));
    b.onResolve({ filter: /^@real\/prisma$/ }, () => ({ path: path.join(NEXA, "src/lib/prisma.ts") }));
    b.onResolve({ filter: /^@\// }, (a) => b.resolve("./" + a.path.slice(2), { resolveDir: path.join(NEXA, "src"), kind: a.kind }));
  } }],
  logLevel: "warning",
});
console.log("built", entry);
