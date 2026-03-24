#!/usr/bin/env node
/**
 * Removes workspace packages created by demo:generate (same paths as demo-stack-config.cjs).
 *
 * Usage: node scripts/demo/remove-demo-stack.cjs
 *   pnpm demo:remove
 */

const fs = require("fs");

const { getDemoPackageAbsPaths, repoRootFromScriptsDemo } = require("./demo-stack-config.cjs");

function main() {
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

main();
