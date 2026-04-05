/**
 * Single source of truth for paths and names used by demo:generate / demo:remove.
 * Keep in sync when extending the demo stack.
 */
const path = require("path");
const { toKebabCase, toCamelCase } = require(
  path.join(__dirname, "..", "..", "plop", "lib", "casing.cjs")
);

const DEMO_DOMAIN = "demo-support";
const DEMO_APPLICATION = "demo-support";
/** Domain entity used for `application-entity-to-dto-mapper` demo step (PascalCase). */
const DEMO_ENTITY = "Ticket";
/** Second domain entity in the demo (`TicketCommentEntity`); used by `domain-service` multi-entity import. */
const DEMO_DOMAIN_SECOND_ENTITY = "TicketComment";
/** Primary composition surface (web). */
const DEMO_COMPOSITION = "demo-web";
/** Extra composition roots (API + BFF) for richer dependency-graph output. */
const DEMO_COMPOSITION_API = "demo-api";
const DEMO_COMPOSITION_BFF = "demo-bff";
const DEMO_DRIVEN_REPO = "driven-repository-demo-support";
const GET_USE_CASE_NAME = "GetTicketById";
const UPDATE_USE_CASE_NAME = "UpdateTicket";
/** Flow base name for `application-flow` + `flowBases` on the demo module (`EscalateTicketFlow`). */
const DEMO_FLOW_NAME = "EscalateTicket";
/** PascalCase name for `application-module` demo scaffold (`SupportInboxModule`, `support-inbox.module.ts`). */
const DEMO_MODULE_NAME = "SupportInbox";
/** Base name for `domain-service` (no `Service` suffix); generates `TicketDemoService` + `ticket-routing.service.ts`. */
const DEMO_DOMAIN_SERVICE = "TicketDemo";

/**
 * Extra domain entities (beyond Ticket + TicketComment) for a larger demo surface.
 * Generator expects base name without `Entity` suffix.
 */
const DEMO_EXTRA_ENTITIES = ["Organization", "Customer", "KnowledgeArticle"];

/**
 * Extra domain services: `{ serviceName, entities }` — entity names without `Entity` suffix (checkbox values).
 */
const DEMO_EXTRA_DOMAIN_SERVICES = [
  { serviceName: "OrgDirectory", entities: ["Organization", "Customer"] },
  { serviceName: "KnowledgeAccess", entities: ["KnowledgeArticle", "Ticket"] },
  { serviceName: "SupportRouting", entities: ["Customer", "Ticket", "Organization"] },
];

/** Extra use-case base names (PascalCase) — empty deps; domain imports patched later for the wiring graph. */
const DEMO_EXTRA_USE_CASES = [
  "ListOpenTickets",
  "GetCustomerProfile",
  "PublishKnowledgeArticle",
  "AssignTicket",
  "SyncKnowledgeIndex",
  "RecordSupportTouchpoint",
];

/** Extra flow base names (besides EscalateTicket). */
const DEMO_EXTRA_FLOWS = ["CustomerOnboarding", "KnowledgePublication"];

/**
 * Extra application modules: `{ modulePascal, useCaseBases[], flowBases[] }`.
 */
const DEMO_EXTRA_MODULES = [
  {
    modulePascal: "CustomerPortal",
    useCaseBases: ["GetCustomerProfile", "ListOpenTickets"],
    flowBases: ["CustomerOnboarding"],
  },
  {
    modulePascal: "KnowledgeBase",
    useCaseBases: ["PublishKnowledgeArticle", "SyncKnowledgeIndex"],
    flowBases: ["KnowledgePublication"],
  },
  {
    modulePascal: "OpsDashboard",
    useCaseBases: ["AssignTicket", "RecordSupportTouchpoint"],
    flowBases: [],
  },
];

/**
 * Minimal app under `apps/*` that imports all demo composition packages so `deps:graph:composition` shows app → composition edges.
 */
const DEMO_APP_STACK_SHELL = "demo-stack-shell";

/**
 * `composition-wire-module` plans after modules exist. Two modules on demo-web; one each on api/bff.
 */
function getDemoCompositionWirePlans() {
  return [
    {
      composition: DEMO_COMPOSITION,
      applicationPackage: DEMO_APPLICATION,
      moduleFileName: `${toKebabCase(DEMO_MODULE_NAME)}.module.ts`,
      propertyKey: toCamelCase(DEMO_MODULE_NAME),
    },
    {
      composition: DEMO_COMPOSITION,
      applicationPackage: DEMO_APPLICATION,
      moduleFileName: "customer-portal.module.ts",
      propertyKey: "customerPortal",
    },
    {
      composition: DEMO_COMPOSITION_API,
      applicationPackage: DEMO_APPLICATION,
      moduleFileName: "ops-dashboard.module.ts",
      propertyKey: "opsDashboard",
    },
    {
      composition: DEMO_COMPOSITION_BFF,
      applicationPackage: DEMO_APPLICATION,
      moduleFileName: "knowledge-base.module.ts",
      propertyKey: "knowledgeBase",
    },
  ];
}

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
    path.join(repoRoot, "packages", "composition", DEMO_COMPOSITION_API),
    path.join(repoRoot, "packages", "composition", DEMO_COMPOSITION_BFF),
    path.join(repoRoot, "apps", DEMO_APP_STACK_SHELL),
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
  DEMO_COMPOSITION_API,
  DEMO_COMPOSITION_BFF,
  DEMO_DRIVEN_REPO,
  GET_USE_CASE_NAME,
  UPDATE_USE_CASE_NAME,
  DEMO_FLOW_NAME,
  DEMO_MODULE_NAME,
  DEMO_DOMAIN_SERVICE,
  DEMO_EXTRA_ENTITIES,
  DEMO_EXTRA_DOMAIN_SERVICES,
  DEMO_EXTRA_USE_CASES,
  DEMO_EXTRA_FLOWS,
  DEMO_EXTRA_MODULES,
  DEMO_APP_STACK_SHELL,
  getDemoCompositionWirePlans,
  getDemoPackageAbsPaths,
  getDemoMarkerPath,
  repoRootFromScriptsDemo,
};
