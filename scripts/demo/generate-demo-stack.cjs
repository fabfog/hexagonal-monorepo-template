#!/usr/bin/env node
/**
 * Non-interactive demo scaffold: runs Plop generators in a fixed order with
 * predetermined answers. Safe to re-read as a checklist of "user prompts".
 *
 * Usage: node scripts/demo/generate-demo-stack.cjs
 * Env:   PLOP_LAYER=All (set automatically) so the plopfile registers every generator.
 *
 * v1 is intentionally minimal: support-style Ticket + repository adapter + composition
 * (isomorphic / server / client) + DataLoader wiring. No secondary Port + driven-port-adapter
 * yet (empty "other" ports break that generator until the port defines methods).
 *
 * After the Ticket entity, the demo also scaffolds one example VO per kind (single-value:
 * string / boolean / number / Date, plus one composite VO) under @domain/demo-support.
 */

const fs = require("fs");
const path = require("path");

const {
  DEMO_APPLICATION,
  DEMO_COMPOSITION,
  DEMO_DOMAIN,
  DEMO_DRIVEN_REPO,
  DEMO_FEATURE,
  DEMO_FEATURE_DIR,
  GET_USE_CASE_NAME,
  UPDATE_USE_CASE_NAME,
  getDemoMarkerPath,
  repoRootFromScriptsDemo,
} = require("./demo-stack-config.cjs");

const REPO_ROOT = repoRootFromScriptsDemo();
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
 * @typedef {{ name: string, answers: Record<string, unknown>, note?: string }} DemoStep
 */

/** Ordered "as if" user answered Plop — read top-to-bottom as the demo checklist. */
const STEPS = /** @type {DemoStep[]} */ ([
  {
    name: "domain-package",
    note: "Domain package for the demo support-ticket model",
    answers: { name: DEMO_DOMAIN },
  },
  {
    name: "domain-entity-zod",
    note: "Ticket + TicketId VO + TicketNotFoundError",
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: "Ticket",
      addNotFoundError: true,
    },
  },
  {
    name: "domain-value-object-zod",
    note: "Example single-value VO (string) for docs / onboarding",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoString",
      valueObjectKind: "single-value",
      singleValuePrimitive: "string",
    },
  },
  {
    name: "domain-value-object-zod",
    note: "Example single-value VO (boolean)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoBoolean",
      valueObjectKind: "single-value",
      singleValuePrimitive: "boolean",
    },
  },
  {
    name: "domain-value-object-zod",
    note: "Example single-value VO (number)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoNumber",
      valueObjectKind: "single-value",
      singleValuePrimitive: "number",
    },
  },
  {
    name: "domain-value-object-zod",
    note: "Example single-value VO (Date)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoDate",
      valueObjectKind: "single-value",
      singleValuePrimitive: "Date",
    },
  },
  {
    name: "domain-value-object-zod",
    note: "Example composite VO (z.object + getProps + deepEqual equals)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoComposite",
      valueObjectKind: "composite",
    },
  },
  {
    name: "application-package",
    note: "Application layer for ports / use cases",
    answers: { packageName: DEMO_APPLICATION },
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
    note: "Composition root",
    answers: { name: DEMO_COMPOSITION },
  },
  {
    name: "composition-feature-dependencies",
    note: "Feature factory registered on needed runtimes",
    answers: {
      packageName: DEMO_COMPOSITION,
      featureName: DEMO_FEATURE,
      runtimes: ["server", "client"],
    },
  },
  {
    name: "composition-wire-use-case",
    note: `Expose ${GET_USE_CASE_NAME} on server`,
    answers: {
      compositionPackage: DEMO_COMPOSITION,
      featureName: DEMO_FEATURE_DIR,
      runtimes: ["server"],
      applicationPackage: DEMO_APPLICATION,
      useCaseName: GET_USE_CASE_NAME,
    },
  },
  {
    name: "composition-wire-use-case",
    note: `Expose ${UPDATE_USE_CASE_NAME} on client bundle`,
    answers: {
      compositionPackage: DEMO_COMPOSITION,
      featureName: DEMO_FEATURE_DIR,
      runtimes: ["client"],
      applicationPackage: DEMO_APPLICATION,
      useCaseName: UPDATE_USE_CASE_NAME,
    },
  },
  {
    name: "composition-wire-react-cache-dataloader",
    note: "Per-request DataLoader registry on server",
    answers: { compositionPackage: DEMO_COMPOSITION },
  },
  {
    name: "composition-wire-infrastructure",
    note: "Lazy TicketRepository on server infrastructure",
    answers: {
      compositionPackage: DEMO_COMPOSITION,
      runtimes: ["server"],
      drivenPackage: DEMO_DRIVEN_REPO,
      infrastructureKey: "ticketRepository",
      adapterClassName: "TicketRepository",
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
    "\n[demo] Done. Next: pnpm install, then wire use cases to real deps / add apps/demo-next in a follow-up."
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[demo] Fatal:", err);
    process.exit(1);
  });
}
