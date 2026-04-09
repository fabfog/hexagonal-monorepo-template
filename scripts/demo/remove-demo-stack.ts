/**
 * Removes workspace packages created by demo:generate (same paths as demo-stack-config).
 *
 * Usage: pnpm exec tsx scripts/demo/remove-demo-stack.ts
 *   pnpm demo:remove
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDemoPackageAbsPaths, repoRootFromScriptsDemo } from "./demo-stack-config.ts";

function main(): void {
  const repoRoot = repoRootFromScriptsDemo();
  const paths = getDemoPackageAbsPaths(repoRoot);
  let removed = 0;

  for (const abs of paths) {
    if (!fs.existsSync(abs)) {
      continue;
    }
    fs.rmSync(abs, { recursive: true, force: true });
    console.log(`[demo:remove] removed ${abs}`);
    removed += 1;
  }

  if (removed === 0) {
    console.log("[demo:remove] Nothing to remove (demo packages not found).");
  } else {
    console.log(
      `[demo:remove] Done (${removed} package dir(s)). Run pnpm install to refresh the lockfile / workspace.`
    );
  }
}

const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main();
}
