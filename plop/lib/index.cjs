const path = require("path");
const casing = require("./casing.cjs");
const packages = require("./packages.cjs");
const addPortToApplicationDeps = require("./add-port-to-application-deps.cjs");

/** Monorepo root (two levels up from this file: plop/lib -> plop -> repo). */
function getRepoRoot() {
  return path.join(__dirname, "..", "..");
}

module.exports = {
  getRepoRoot,
  ...casing,
  ...packages,
  ...addPortToApplicationDeps,
};
