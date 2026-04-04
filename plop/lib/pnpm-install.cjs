"use strict";

const { spawnSync } = require("child_process");

const INSTALL_HINT =
  "Workspace packages or zod may not be linked yet. From the repo root run: pnpm install\n" +
  "Or re-run with --confirm-install so this tool can run pnpm install for you " +
  "(e.g. pnpm plop application-entity-to-dto-mapper -- --confirm-install).";

/**
 * True if user passed --confirm-install on the CLI or set PLOP_CONFIRM_INSTALL=1|true|yes.
 */
function isConfirmInstallEnabled() {
  const env = process.env.PLOP_CONFIRM_INSTALL;
  if (env === "1" || env === "true" || env === "yes") return true;
  return process.argv.includes("--confirm-install");
}

/**
 * @param {string} repoRoot
 */
function runPnpmInstall(repoRoot) {
  const result = spawnSync("pnpm", ["install"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    throw new Error(`pnpm install failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`pnpm install exited with code ${result.status ?? "unknown"}`);
  }
}

/**
 * Runs pnpm install only if consent was given; otherwise throws with INSTALL_HINT.
 * @param {string} repoRoot
 * @param {{ context?: string }} [opts]
 */
function runPnpmInstallWithConsentOrThrow(repoRoot, opts = {}) {
  const ctx = opts.context ? `${opts.context}\n\n` : "";
  if (!isConfirmInstallEnabled()) {
    throw new Error(`${ctx}${INSTALL_HINT}`);
  }
  console.log("[plop] Running pnpm install (--confirm-install / PLOP_CONFIRM_INSTALL)…");
  runPnpmInstall(repoRoot);
}

module.exports = {
  isConfirmInstallEnabled,
  runPnpmInstall,
  runPnpmInstallWithConsentOrThrow,
  INSTALL_HINT,
};
