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
    note: "Bounded context package for the mini support-ticket model",
    answers: { name: DEMO_DOMAIN },
  },
  {
    name: "domain-entity-zod",
    note: "Ticket + TicketId VO + TicketNotFoundError (confirm pre-answered)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: "Ticket",
      addNotFoundError: true,
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
    note: "Load a ticket (composed with repository later in real code)",
    answers: {
      packageName: DEMO_APPLICATION,
      useCaseName: "GetTicketById",
    },
  },
  {
    name: "application-use-case",
    note: "Second use case for composition demos (client/server wiring)",
    answers: {
      packageName: DEMO_APPLICATION,
      useCaseName: "LogSupportDemoEvent",
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
    note: "Composition root with isomorphic, server, and client entry points",
    answers: { name: DEMO_COMPOSITION },
  },
  {
    name: "composition-feature-dependencies",
    note: "Feature factory registered on all three runtimes",
    answers: {
      packageName: DEMO_COMPOSITION,
      featureName: DEMO_FEATURE,
      runtimes: ["isomorphic", "server", "client"],
    },
  },
  {
    name: "composition-wire-use-case",
    note: "Expose GetTicketById on server (RSC / server actions friendly)",
    answers: {
      compositionPackage: DEMO_COMPOSITION,
      featureName: DEMO_FEATURE_DIR,
      runtimes: ["server"],
      applicationPackage: DEMO_APPLICATION,
      useCaseName: "GetTicketById",
    },
  },
  {
    name: "composition-wire-use-case",
    note: "Expose LogSupportDemoEvent on client bundle",
    answers: {
      compositionPackage: DEMO_COMPOSITION,
      featureName: DEMO_FEATURE_DIR,
      runtimes: ["client"],
      applicationPackage: DEMO_APPLICATION,
      useCaseName: "LogSupportDemoEvent",
    },
  },
  {
    name: "composition-wire-react-cache-dataloader",
    note: "Per-request DataLoader registry on server (before repository infra wiring)",
    answers: { compositionPackage: DEMO_COMPOSITION },
  },
  {
    name: "composition-wire-infrastructure",
    note: "Lazy TicketRepository on server infrastructure (needs get-data-loader-registry.ts)",
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
