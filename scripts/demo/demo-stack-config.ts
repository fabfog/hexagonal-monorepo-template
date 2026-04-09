import path from "node:path";
import { fileURLToPath } from "node:url";
import { toKebabCase, toCamelCase } from "../../plop/lib/casing.ts";

/**
 * Single source of truth for paths and names used by demo:generate / demo:remove.
 * Keep in sync when extending the demo stack.
 */
export const DEMO_DOMAIN = "demo-support";
export const DEMO_APPLICATION = "demo-support";
/** Domain entity used for `application-entity-to-dto-mapper` demo step (PascalCase). */
export const DEMO_ENTITY = "Ticket";
/** Second domain entity in the demo (`TicketCommentEntity`); used by `domain-service` multi-entity import. */
export const DEMO_DOMAIN_SECOND_ENTITY = "TicketComment";
/** Primary composition surface (web). */
export const DEMO_COMPOSITION = "demo-web";
/** Extra composition roots (API + BFF) for richer dependency-graph output. */
export const DEMO_COMPOSITION_API = "demo-api";
export const DEMO_COMPOSITION_BFF = "demo-bff";
export const DEMO_DRIVEN_REPO = "driven-repository-demo-support";
export const GET_USE_CASE_NAME = "GetTicketById";
export const UPDATE_USE_CASE_NAME = "UpdateTicket";
/** Flow base name for `application-flow` + `flowBases` on the demo module (`EscalateTicketFlow`). */
export const DEMO_FLOW_NAME = "EscalateTicket";
/** PascalCase name for `application-module` demo scaffold (`SupportInboxModule`, `support-inbox.module.ts`). */
export const DEMO_MODULE_NAME = "SupportInbox";
/** Base name for `domain-service` (no `Service` suffix); generates `TicketDemoService` + `ticket-routing.service.ts`. */
export const DEMO_DOMAIN_SERVICE = "TicketDemo";

/**
 * Extra domain entities (beyond Ticket + TicketComment) for a larger demo surface.
 * Generator expects base name without `Entity` suffix.
 */
export const DEMO_EXTRA_ENTITIES = ["Organization", "Customer", "KnowledgeArticle"] as const;

/**
 * Extra domain services: `{ serviceName, entities }` — entity names without `Entity` suffix (checkbox values).
 */
export const DEMO_EXTRA_DOMAIN_SERVICES: readonly {
  serviceName: string;
  entities: readonly string[];
}[] = [
  { serviceName: "OrgDirectory", entities: ["Organization", "Customer"] },
  { serviceName: "KnowledgeAccess", entities: ["KnowledgeArticle", "Ticket"] },
  { serviceName: "SupportRouting", entities: ["Customer", "Ticket", "Organization"] },
];

/** Extra use-case base names (PascalCase) — empty deps; domain imports patched later for the wiring graph. */
export const DEMO_EXTRA_USE_CASES = [
  "ListOpenTickets",
  "GetCustomerProfile",
  "PublishKnowledgeArticle",
  "AssignTicket",
  "SyncKnowledgeIndex",
  "RecordSupportTouchpoint",
] as const;

/** Extra flow base names (besides EscalateTicket). */
export const DEMO_EXTRA_FLOWS = ["CustomerOnboarding", "KnowledgePublication"] as const;

/**
 * Extra application modules: `{ modulePascal, useCaseBases[], flowBases[] }`.
 */
export const DEMO_EXTRA_MODULES: readonly {
  modulePascal: string;
  useCaseBases: readonly string[];
  flowBases: readonly string[];
}[] = [
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
export const DEMO_APP_STACK_SHELL = "demo-stack-shell";

export interface DemoCompositionWirePlan {
  composition: string;
  applicationPackage: string;
  moduleFileName: string;
  propertyKey: string;
}

/**
 * `composition-wire-module` plans after modules exist. Two modules on demo-web; one each on api/bff.
 */
export function getDemoCompositionWirePlans(): DemoCompositionWirePlan[] {
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

export function repoRootFromScriptsDemo(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function getDemoPackageAbsPaths(repoRoot: string = repoRootFromScriptsDemo()): string[] {
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

export function getDemoMarkerPath(repoRoot: string): string {
  return path.join(repoRoot, "packages", "domain", DEMO_DOMAIN);
}
