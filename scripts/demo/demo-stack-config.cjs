/**
 * Single source of truth for paths and names used by demo:generate / demo:remove.
 * Keep in sync when extending the demo stack.
 */
const path = require("path");

const DEMO_DOMAIN = "demo-support";
const DEMO_APPLICATION = "demo-support";
const DEMO_COMPOSITION = "demo-web";
const DEMO_DRIVEN_REPO = "driven-repository-demo-support";
const DEMO_FEATURE = "SupportInbox";
const DEMO_FEATURE_DIR = "support-inbox";
const GET_USE_CASE_NAME = "GetTicketById";
const UPDATE_USE_CASE_NAME = "UpdateTicket";

function repoRootFromScriptsDemo() {
  return path.resolve(__dirname, "..", "..");
}

/**
 * @param {string} [repoRoot]
 * @returns {string[]}
 */
function getDemoPackageAbsPaths(repoRoot = repoRootFromScriptsDemo()) {
  return [
    path.join(repoRoot, "packages", "domain", DEMO_DOMAIN),
    path.join(repoRoot, "packages", "application", DEMO_APPLICATION),
    path.join(repoRoot, "packages", "infrastructure", DEMO_DRIVEN_REPO),
    path.join(repoRoot, "packages", "composition", DEMO_COMPOSITION),
  ];
}

/**
 * @param {string} repoRoot
 */
function getDemoMarkerPath(repoRoot) {
  return path.join(repoRoot, "packages", "domain", DEMO_DOMAIN);
}

module.exports = {
  DEMO_DOMAIN,
  DEMO_APPLICATION,
  DEMO_COMPOSITION,
  DEMO_DRIVEN_REPO,
  DEMO_FEATURE,
  DEMO_FEATURE_DIR,
  GET_USE_CASE_NAME,
  UPDATE_USE_CASE_NAME,
  getDemoPackageAbsPaths,
  getDemoMarkerPath,
  repoRootFromScriptsDemo,
};
