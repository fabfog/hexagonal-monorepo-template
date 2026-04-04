/**
 * Single source of truth for paths and names used by demo:generate / demo:remove.
 * Keep in sync when extending the demo stack.
 */
const path = require("path");

const DEMO_DOMAIN = "demo-support";
const DEMO_APPLICATION = "demo-support";
/** Domain entity used for `application-entity-to-dto-mapper` demo step (PascalCase). */
const DEMO_ENTITY = "Ticket";
/** Second domain entity in the demo (`TicketCommentEntity`); used by `domain-service` multi-entity import. */
const DEMO_DOMAIN_SECOND_ENTITY = "TicketComment";
const DEMO_COMPOSITION = "demo-web";
const DEMO_DRIVEN_REPO = "driven-repository-demo-support";
const GET_USE_CASE_NAME = "GetTicketById";
const UPDATE_USE_CASE_NAME = "UpdateTicket";
/** Flow base name for `application-flow` + `flowBases` on the demo module (`EscalateTicketFlow`). */
const DEMO_FLOW_NAME = "EscalateTicket";
/** PascalCase name for `application-module` demo scaffold (`SupportInboxModule`, `support-inbox.module.ts`). */
const DEMO_MODULE_NAME = "SupportInbox";
/** Base name for `domain-service` (no `Service` suffix); generates `TicketDemoService` + `ticket-routing.service.ts`. */
const DEMO_DOMAIN_SERVICE = "TicketDemo";

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
  DEMO_ENTITY,
  DEMO_DOMAIN_SECOND_ENTITY,
  DEMO_COMPOSITION,
  DEMO_DRIVEN_REPO,
  GET_USE_CASE_NAME,
  UPDATE_USE_CASE_NAME,
  DEMO_FLOW_NAME,
  DEMO_MODULE_NAME,
  DEMO_DOMAIN_SERVICE,
  getDemoPackageAbsPaths,
  getDemoMarkerPath,
  repoRootFromScriptsDemo,
};
