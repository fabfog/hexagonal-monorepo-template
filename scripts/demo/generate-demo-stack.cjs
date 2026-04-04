#!/usr/bin/env node
/**
 * Non-interactive demo scaffold: runs Plop generators in a fixed order with
 * predetermined answers. Safe to re-read as a checklist of "user prompts".
 *
 * Usage: node scripts/demo/generate-demo-stack.cjs
 * Env:   PLOP_LAYER=All (set automatically) so the plopfile registers every generator.
 *
 * v1 is intentionally minimal: support-style Ticket + repository adapter + one composition
 * package (`src/index.ts`). No secondary Port + driven-port-adapter yet (empty "other" ports
 * break that generator until the port defines methods).
 *
 * After the Ticket entity (`domain-entity`), `domain-entity-add-vo-field` adds Slug (@domain/core). The demo scaffolds
 * example VOs under @domain/demo-support (including DemoComposite as a standalone sample), then adds
 * more Ticket fields: Email + Locale from core, DemoString + DemoBoolean from the same package.
 *
 * A second entity (`SupportQueueEntity`) and `domain-service` (`TicketRoutingService`) import both `Ticket` and `SupportQueue` entity types.
 *
 * After `@application/demo-support` exists, `application-entity-to-dto-mapper` adds Ticket DTO +
 * `mapTicketToDTO` (+ test) under `src/dtos` and `src/mappers`.
 *
 * Also adds an example flow (`EscalateTicket` + interaction port), then an application module under
 * `src/modules/`: `application-module` wires `GetTicketById` + that flow, then `application-wire-module`
 * adds `UpdateTicket`.
 * Then `composition-wire-module` wires `SupportInboxModule` into `@composition/demo-web` `getDemoWebModules`.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { toKebabCase, toCamelCase } = require(
  path.join(__dirname, "..", "..", "plop", "lib", "casing.cjs")
);

const {
  DEMO_APPLICATION,
  DEMO_COMPOSITION,
  DEMO_DOMAIN,
  DEMO_ENTITY,
  DEMO_DOMAIN_SECOND_ENTITY,
  DEMO_DRIVEN_REPO,
  DEMO_MODULE_NAME,
  GET_USE_CASE_NAME,
  UPDATE_USE_CASE_NAME,
  DEMO_FLOW_NAME,
  DEMO_DOMAIN_SERVICE,
  getDemoMarkerPath,
  repoRootFromScriptsDemo,
} = require("./demo-stack-config.cjs");

const REPO_ROOT = repoRootFromScriptsDemo();
/** `support-inbox.module.ts` when `DEMO_MODULE_NAME` is `SupportInbox`. */
const DEMO_MODULE_FILE = `${toKebabCase(DEMO_MODULE_NAME)}.module.ts`;
/** Property key in composition `get*Modules` return object (`supportInbox` for `SupportInbox`). */
const DEMO_MODULE_PROPERTY_KEY = toCamelCase(DEMO_MODULE_NAME);
const MARKER = getDemoMarkerPath(REPO_ROOT);

function assertCleanOrForce() {
  const force = process.argv.includes("--force");
  if (fs.existsSync(MARKER) && !force) {
    console.error(
      `[demo] Refusing to run: ${MARKER} already exists.\n` +
        "Remove the demo packages or re-run with --force (may fail on duplicate files)."
    );
    process.exit(1);
  }
}

/**
 * @typedef {{
 *   name: string,
 *   answers?: Record<string, unknown>,
 *   note?: string,
 *   run?: () => void,
 * }} DemoStep
 */

/** Ordered "as if" user answered Plop — read top-to-bottom as the demo checklist. */
const STEPS = /** @type {DemoStep[]} */ ([
  {
    name: "domain-package",
    note: "Domain package for the demo support-ticket model",
    answers: { name: DEMO_DOMAIN },
  },
  {
    name: "domain-entity",
    note: "Ticket + TicketId VO + TicketNotFoundError",
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: "Ticket",
      addNotFoundError: true,
    },
  },
  {
    name: "domain-entity-add-vo-field",
    note: "Ticket.slug from @domain/core (Slug)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: "Ticket",
      propName: "slug",
      voSelection: { voClass: "Slug", source: "core" },
    },
  },
  {
    name: "domain-value-object",
    note: "Example single-value VO (string) for docs / onboarding",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoString",
      valueObjectKind: "single-value",
      singleValuePrimitive: "string",
    },
  },
  {
    name: "domain-value-object",
    note: "Example single-value VO (boolean)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoBoolean",
      valueObjectKind: "single-value",
      singleValuePrimitive: "boolean",
    },
  },
  {
    name: "domain-value-object",
    note: "Example single-value VO (number)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoNumber",
      valueObjectKind: "single-value",
      singleValuePrimitive: "number",
    },
  },
  {
    name: "domain-value-object",
    note: "Example single-value VO (Date)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoDate",
      valueObjectKind: "single-value",
      singleValuePrimitive: "Date",
    },
  },
  {
    name: "domain-value-object",
    note: "Example composite VO (z.object + getProps + deepEqual equals)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoComposite",
      valueObjectKind: "composite",
    },
  },
  {
    name: "domain-entity-add-vo-field",
    note: "Ticket.customerEmail (Email @domain/core)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: "Ticket",
      propName: "customerEmail",
      voSelection: { voClass: "Email", source: "core" },
    },
  },
  {
    name: "domain-entity-add-vo-field",
    note: "Ticket.locale (Locale @domain/core)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: "Ticket",
      propName: "locale",
      voSelection: { voClass: "Locale", source: "core" },
    },
  },
  {
    name: "domain-entity-add-vo-field",
    note: "Ticket.subject (DemoString)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: "Ticket",
      propName: "subject",
      voSelection: { voClass: "DemoString", source: "local" },
    },
  },
  {
    name: "domain-entity-add-vo-field",
    note: "Ticket.isEscalated (DemoBoolean)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: "Ticket",
      propName: "isEscalated",
      voSelection: { voClass: "DemoBoolean", source: "local" },
    },
  },
  {
    name: "domain-entity",
    note: `${DEMO_DOMAIN_SECOND_ENTITY} + ${DEMO_DOMAIN_SECOND_ENTITY}Id VO + not-found error`,
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: DEMO_DOMAIN_SECOND_ENTITY,
      addNotFoundError: true,
    },
  },
  {
    name: "domain-service",
    note: `${DEMO_DOMAIN_SERVICE}Service (imports Ticket + ${DEMO_DOMAIN_SECOND_ENTITY} entities)`,
    answers: {
      domainPackage: DEMO_DOMAIN,
      selectedEntities: ["Ticket", DEMO_DOMAIN_SECOND_ENTITY],
      serviceName: DEMO_DOMAIN_SERVICE,
    },
  },
  {
    name: "__pnpm_install__",
    note: "intermediate pnpm install (so TypeScript can resolve zod + @domain/* for DTO/mapper codegen)",
    run: () => {
      const result = spawnSync("pnpm", ["install"], {
        cwd: REPO_ROOT,
        stdio: "inherit",
        shell: process.platform === "win32",
      });
      if (result.error) {
        console.error("[demo] pnpm install failed:", result.error);
        process.exit(1);
      }
      if (result.status !== 0) {
        process.exit(result.status ?? 1);
      }
    },
  },
  {
    name: "application-package",
    note: "Application layer for ports / use cases",
    answers: { packageName: DEMO_APPLICATION },
  },
  {
    name: "application-entity-to-dto-mapper",
    note: `${DEMO_ENTITY}DTO + map${DEMO_ENTITY}ToDTO + mapper test`,
    answers: {
      packageName: DEMO_DOMAIN,
      entityName: DEMO_ENTITY,
    },
  },
  {
    name: "application-port",
    note: "TicketRepositoryPort with getById → TicketEntity",
    answers: {
      packageName: DEMO_APPLICATION,
      portKind: "repository",
      domainPackageForEntity: DEMO_DOMAIN,
      entityPascal: "Ticket",
      repositoryBaseName: "",
    },
  },
  {
    name: "application-use-case",
    note: "Load a ticket",
    answers: {
      packageName: DEMO_APPLICATION,
      useCaseName: GET_USE_CASE_NAME,
    },
  },
  {
    name: "application-add-dependency-to-use-case",
    note: `Inject TicketRepository port into ${GET_USE_CASE_NAME} deps`,
    answers: {
      packageName: DEMO_APPLICATION,
      useCaseName: GET_USE_CASE_NAME,
      portApplicationPackage: DEMO_APPLICATION,
      portFileName: "ticket.repository.port.ts",
      portPropertyName: "ticketRepository",
    },
  },
  {
    name: "application-use-case",
    note: "Update a ticket",
    answers: {
      packageName: DEMO_APPLICATION,
      useCaseName: UPDATE_USE_CASE_NAME,
    },
  },
  {
    name: "application-add-dependency-to-use-case",
    note: `Inject TicketRepository port into ${UPDATE_USE_CASE_NAME} deps`,
    answers: {
      packageName: DEMO_APPLICATION,
      useCaseName: UPDATE_USE_CASE_NAME,
      portApplicationPackage: DEMO_APPLICATION,
      portFileName: "ticket.repository.port.ts",
      portPropertyName: "ticketRepository",
    },
  },
  {
    name: "application-flow",
    note: "Example flow + interaction port (orchestration stub)",
    answers: {
      packageName: DEMO_APPLICATION,
      flowName: DEMO_FLOW_NAME,
    },
  },
  {
    name: "application-module",
    note: `${DEMO_MODULE_NAME}Module + Infra: GetTicketById + ${DEMO_FLOW_NAME}Flow (./modules export)`,
    answers: {
      packageName: DEMO_APPLICATION,
      moduleName: DEMO_MODULE_NAME,
      useCaseBases: [GET_USE_CASE_NAME],
      flowBases: [DEMO_FLOW_NAME],
    },
  },
  {
    name: "application-wire-module",
    note: `Progressive wiring: add UpdateTicketUseCase to ${DEMO_MODULE_NAME}Module`,
    answers: {
      packageName: DEMO_APPLICATION,
      moduleFileName: DEMO_MODULE_FILE,
      useCaseBases: [UPDATE_USE_CASE_NAME],
      flowBases: [],
    },
  },
  {
    name: "infrastructure-driven-adapter-package",
    note: "Persistence-side package (repository adapter target)",
    answers: { name: "demo-support", isRepository: true },
  },
  {
    name: "driven-repository-add-repository",
    note: "Ky + DataLoader repository implementing TicketRepositoryPort",
    answers: {
      applicationPackage: DEMO_APPLICATION,
      portFile: "ticket.repository.port.ts",
      drivenPackage: DEMO_DRIVEN_REPO,
      repositoryBaseName: "",
    },
  },
  {
    name: "composition-package",
    note: "Composition root (src/index.ts + exports)",
    answers: { name: DEMO_COMPOSITION },
  },
  {
    name: "composition-wire-module",
    note: `Wire ${DEMO_MODULE_NAME}Module into @composition/${DEMO_COMPOSITION} get*Modules return`,
    answers: {
      compositionPackage: DEMO_COMPOSITION,
      applicationPackage: DEMO_APPLICATION,
      moduleFileName: DEMO_MODULE_FILE,
      propertyKey: DEMO_MODULE_PROPERTY_KEY,
    },
  },
  {
    name: "__pnpm_install__",
    note: "final pnpm install",
    run: () => {
      const result = spawnSync("pnpm", ["install"], {
        cwd: REPO_ROOT,
        stdio: "inherit",
        shell: process.platform === "win32",
      });
      if (result.error) {
        console.error("[demo] pnpm install failed:", result.error);
        process.exit(1);
      }
      if (result.status !== 0) {
        process.exit(result.status ?? 1);
      }
    },
  },
]);

async function loadPlop() {
  process.env.PLOP_LAYER = process.env.PLOP_LAYER || "All";
  const { default: nodePlop } = await import("node-plop");
  const plopfile = path.join(REPO_ROOT, "plop", "plopfile.cjs");
  const force = process.argv.includes("--force");
  return nodePlop(plopfile, { force });
}

async function main() {
  assertCleanOrForce();

  const plop = await loadPlop();

  let index = 0;
  for (const step of STEPS) {
    index += 1;
    const label = step.note ? `${step.name} — ${step.note}` : step.name;
    console.log(`\n[demo] ${index}/${STEPS.length} ${label}`);

    if (typeof step.run === "function") {
      step.run();
      console.log(`[demo] OK`);
      continue;
    }

    const generator = plop.getGenerator(step.name);
    const { failures, changes } = await generator.runActions({ ...step.answers });

    if (failures.length > 0) {
      for (const f of failures) {
        console.error(`[demo] Action failed (${f.type} ${f.path}):`, f.error);
      }
      process.exit(1);
    }

    console.log(`[demo] OK (${changes.length} action(s))`);
  }

  console.log(
    "\n[demo] Done. Next: implement `getForContext` in composition infrastructure so it satisfies module Infra types, then hook apps to `@composition/" +
      DEMO_COMPOSITION +
      "`."
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[demo] Fatal:", err);
    process.exit(1);
  });
}
