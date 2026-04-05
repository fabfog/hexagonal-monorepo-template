#!/usr/bin/env node
/**
 * Non-interactive demo scaffold: runs Plop generators in a fixed order with
 * predetermined answers. Safe to re-read as a checklist of "user prompts".
 *
 * Usage: node scripts/demo/generate-demo-stack.cjs [--confirm-install] [--force]
 * Env:   PLOP_LAYER=All (set automatically) so the plopfile registers every generator.
 *
 * **Expanded demo stack** (default): besides the original Ticket/support stack, adds extra
 * domain entities + services, several use-cases/flows, **four** application modules, and
 * **three** composition packages (`demo-web`, `demo-api`, `demo-bff`) wired to different modules.
 * Creates `apps/demo-stack-shell` importing all three `@composition/*` roots so
 * `pnpm deps:graph:composition` shows realistic app → composition edges — useful to stress-test
 * composition / package graph outputs (Mermaid, DOT, etc.).
 *
 * Original Ticket path: VOs, TicketComment, `TicketDemoService`, `@application/demo-support`,
 * repository port + adapter, `SupportInboxModule`, `@composition/demo-web`, request-scoped
 * HTTP client + DataLoader registry wiring in composition.
 *
 * Install steps: `pnpm install` runs only with consent — pass `--confirm-install`, `--force`, or set
 * `DEMO_CONFIRM_INSTALL=1`. The `pnpm demo:generate` script includes `--confirm-install`.
 */

const fs = require("fs");
const path = require("path");
const { toKebabCase } = require(path.join(__dirname, "..", "..", "plop", "lib", "casing.cjs"));
const { runPnpmInstall } = require(
  path.join(__dirname, "..", "..", "plop", "lib", "pnpm-install.cjs")
);

const {
  DEMO_APPLICATION,
  DEMO_COMPOSITION,
  DEMO_COMPOSITION_API,
  DEMO_COMPOSITION_BFF,
  DEMO_DOMAIN,
  DEMO_ENTITY,
  DEMO_DOMAIN_SECOND_ENTITY,
  DEMO_DRIVEN_REPO,
  DEMO_MODULE_NAME,
  GET_USE_CASE_NAME,
  UPDATE_USE_CASE_NAME,
  DEMO_FLOW_NAME,
  DEMO_DOMAIN_SERVICE,
  DEMO_EXTRA_ENTITIES,
  DEMO_EXTRA_DOMAIN_SERVICES,
  DEMO_EXTRA_USE_CASES,
  DEMO_EXTRA_FLOWS,
  DEMO_EXTRA_MODULES,
  DEMO_APP_STACK_SHELL,
  getDemoCompositionWirePlans,
  getDemoMarkerPath,
  repoRootFromScriptsDemo,
} = require("./demo-stack-config.cjs");

const REPO_ROOT = repoRootFromScriptsDemo();
const DEMO_MODULE_FILE = `${toKebabCase(DEMO_MODULE_NAME)}.module.ts`;
const MARKER = getDemoMarkerPath(REPO_ROOT);

function hasDemoPnpmInstallConsent() {
  return (
    process.argv.includes("--confirm-install") ||
    process.argv.includes("--force") ||
    process.env.DEMO_CONFIRM_INSTALL === "1"
  );
}

/**
 * @param {string} stepNote
 */
function runDemoPnpmInstall(stepNote) {
  if (!hasDemoPnpmInstallConsent()) {
    console.error(
      `[demo] Refusing to run pnpm install (${stepNote}).\n` +
        "Use: pnpm demo:generate (adds --confirm-install), or pass --confirm-install / --force, " +
        "or set DEMO_CONFIRM_INSTALL=1, or run pnpm install yourself and skip these steps.\n"
    );
    process.exit(1);
  }
  runPnpmInstall(REPO_ROOT);
}

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

/**
 * Type-only imports so `deps:graph:composition` links use-cases/flows → domain entities.
 */
function patchDemoStackDomainImports() {
  const appRoot = path.join(REPO_ROOT, "packages", "application", DEMO_APPLICATION);
  const ucDir = path.join(appRoot, "src", "use-cases");
  const flowDir = path.join(appRoot, "src", "flows");

  /** @type {Record<string, string[]>} */
  const useCaseEntityTypes = {
    "list-open-tickets": ["TicketEntity"],
    "get-customer-profile": ["CustomerEntity"],
    "publish-knowledge-article": ["KnowledgeArticleEntity"],
    "assign-ticket": ["TicketEntity", "OrganizationEntity"],
    "sync-knowledge-index": ["KnowledgeArticleEntity"],
    "record-support-touchpoint": ["CustomerEntity", "TicketEntity"],
  };
  /** @type {Record<string, string[]>} */
  const flowEntityTypes = {
    "customer-onboarding": ["CustomerEntity", "OrganizationEntity"],
    "knowledge-publication": ["KnowledgeArticleEntity", "TicketEntity"],
  };

  for (const [kebab, types] of Object.entries(useCaseEntityTypes)) {
    const fp = path.join(ucDir, `${kebab}.use-case.ts`);
    prependDomainEntityTypeImports(fp, types);
  }
  for (const [kebab, types] of Object.entries(flowEntityTypes)) {
    const fp = path.join(flowDir, `${kebab}.flow.ts`);
    prependDomainEntityTypeImports(fp, types);
  }
}

/**
 * @param {string} filePath
 * @param {string[]} entityTypeNames
 */
function prependDomainEntityTypeImports(filePath, entityTypeNames) {
  if (!fs.existsSync(filePath)) return;
  const t = fs.readFileSync(filePath, "utf8");
  if (t.includes(`@domain/${DEMO_DOMAIN}/entities`)) return;
  const line = `import type { ${entityTypeNames.join(", ")} } from "@domain/${DEMO_DOMAIN}/entities";`;
  fs.writeFileSync(filePath, `${line}\n${t}`, "utf8");
}

function ensureDemoStackAppShell() {
  const appDir = path.join(REPO_ROOT, "apps", DEMO_APP_STACK_SHELL);
  const srcDir = path.join(appDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  const pkgPath = path.join(appDir, "package.json");
  const pkg = {
    name: DEMO_APP_STACK_SHELL,
    private: true,
    type: "module",
    dependencies: {
      [`@composition/${DEMO_COMPOSITION}`]: "workspace:*",
      [`@composition/${DEMO_COMPOSITION_API}`]: "workspace:*",
      [`@composition/${DEMO_COMPOSITION_BFF}`]: "workspace:*",
    },
  };
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(appDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        $schema: "https://json.schemastore.org/tsconfig",
        extends: "../../tsconfig.repo.json",
        compilerOptions: { lib: ["ES2022"], noEmit: true },
        include: ["src"],
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(srcDir, "composition-roots.ts"),
    `/** Referenced by the composition wiring graph (apps → @composition/*). Not a production bootstrap. */\n` +
      `import "@composition/${DEMO_COMPOSITION}";\n` +
      `import "@composition/${DEMO_COMPOSITION_API}";\n` +
      `import "@composition/${DEMO_COMPOSITION_BFF}";\n`
  );
}

function patchDemoWebRepositoryWiring() {
  const infraPath = path.join(
    REPO_ROOT,
    "packages",
    "composition",
    DEMO_COMPOSITION,
    "src",
    "infrastructure.ts"
  );
  if (!fs.existsSync(infraPath)) return;

  const source = fs.readFileSync(infraPath, "utf8");
  const patched = source.replace(
    '        prefixUrl: "FIXME-base-url",',
    '        prefixUrl: "https://example.invalid/api/",'
  );
  if (patched === source) {
    return;
  }
  fs.writeFileSync(infraPath, patched, "utf8");
}

/**
 * @returns {DemoStep[]}
 */
function buildDemoSteps() {
  /** @type {DemoStep[]} */
  const s = [];

  s.push({
    name: "domain-package",
    note: "Domain package for the demo support-ticket model",
    answers: { name: DEMO_DOMAIN },
  });
  s.push({
    name: "domain-entity",
    note: "Ticket + TicketId VO + TicketNotFoundError",
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: "Ticket",
      addNotFoundError: true,
    },
  });
  s.push({
    name: "domain-entity-add-vo-field",
    note: "Ticket.slug from @domain/core (Slug)",
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: "Ticket",
      propName: "slug",
      voSelection: { voClass: "Slug", source: "core" },
    },
  });
  for (const vo of [
    ["DemoString", "string"],
    ["DemoBoolean", "boolean"],
    ["DemoNumber", "number"],
    ["DemoDate", "Date"],
  ]) {
    s.push({
      name: "domain-value-object",
      note: `Example VO (${vo[1]})`,
      answers: {
        domainPackage: DEMO_DOMAIN,
        valueObjectName: vo[0],
        valueObjectKind: "single-value",
        singleValuePrimitive: vo[1],
      },
    });
  }
  s.push({
    name: "domain-value-object",
    note: "Example composite VO",
    answers: {
      domainPackage: DEMO_DOMAIN,
      valueObjectName: "DemoComposite",
      valueObjectKind: "composite",
    },
  });
  for (const [propName, voClass, source] of [
    ["customerEmail", "Email", "core"],
    ["locale", "Locale", "core"],
    ["subject", "DemoString", "local"],
    ["isEscalated", "DemoBoolean", "local"],
  ]) {
    s.push({
      name: "domain-entity-add-vo-field",
      note: `Ticket.${propName}`,
      answers: {
        domainPackage: DEMO_DOMAIN,
        entityName: "Ticket",
        propName,
        voSelection: { voClass, source },
      },
    });
  }
  s.push({
    name: "domain-entity",
    note: `${DEMO_DOMAIN_SECOND_ENTITY} + Id VO + not-found error`,
    answers: {
      domainPackage: DEMO_DOMAIN,
      entityName: DEMO_DOMAIN_SECOND_ENTITY,
      addNotFoundError: true,
    },
  });
  for (const entityName of DEMO_EXTRA_ENTITIES) {
    s.push({
      name: "domain-entity",
      note: `Demo stack: ${entityName}Entity (+ Id VO + not-found)`,
      answers: {
        domainPackage: DEMO_DOMAIN,
        entityName,
        addNotFoundError: true,
      },
    });
  }
  s.push({
    name: "domain-service",
    note: `${DEMO_DOMAIN_SERVICE}Service (Ticket + ${DEMO_DOMAIN_SECOND_ENTITY})`,
    answers: {
      domainPackage: DEMO_DOMAIN,
      selectedEntities: ["Ticket", DEMO_DOMAIN_SECOND_ENTITY],
      serviceName: DEMO_DOMAIN_SERVICE,
    },
  });
  for (const { serviceName, entities } of DEMO_EXTRA_DOMAIN_SERVICES) {
    s.push({
      name: "domain-service",
      note: `Demo stack: ${serviceName}Service`,
      answers: {
        domainPackage: DEMO_DOMAIN,
        selectedEntities: entities,
        serviceName,
      },
    });
  }
  s.push({
    name: "__pnpm_install__",
    note: "intermediate pnpm install (TypeScript + @domain/* for DTO/mapper)",
    run: () => {
      try {
        runDemoPnpmInstall("before application-entity-to-dto-mapper");
      } catch (e) {
        console.error("[demo] pnpm install failed:", e);
        process.exit(1);
      }
    },
  });
  s.push({
    name: "application-package",
    note: "Application layer for ports / use cases",
    answers: { packageName: DEMO_APPLICATION },
  });
  s.push({
    name: "application-entity-to-dto-mapper",
    note: `${DEMO_ENTITY}DTO + map${DEMO_ENTITY}ToDTO + mapper test`,
    answers: {
      packageName: DEMO_DOMAIN,
      entityName: DEMO_ENTITY,
    },
  });
  s.push({
    name: "application-port",
    note: "TicketRepositoryPort with getById → TicketEntity",
    answers: {
      packageName: DEMO_APPLICATION,
      portKind: "repository",
      domainPackageForEntity: DEMO_DOMAIN,
      entityPascal: "Ticket",
      repositoryBaseName: "",
    },
  });
  s.push({
    name: "application-use-case",
    note: "Load a ticket",
    answers: {
      packageName: DEMO_APPLICATION,
      useCaseName: GET_USE_CASE_NAME,
    },
  });
  s.push({
    name: "application-add-dependency-to-use-case",
    note: `Inject TicketRepository port into ${GET_USE_CASE_NAME} deps`,
    answers: {
      packageName: DEMO_APPLICATION,
      useCaseName: GET_USE_CASE_NAME,
      portApplicationPackage: DEMO_APPLICATION,
      portFileName: "ticket.repository.port.ts",
      portPropertyName: "ticketRepository",
    },
  });
  s.push({
    name: "application-use-case",
    note: "Update a ticket",
    answers: {
      packageName: DEMO_APPLICATION,
      useCaseName: UPDATE_USE_CASE_NAME,
    },
  });
  s.push({
    name: "application-add-dependency-to-use-case",
    note: `Inject TicketRepository port into ${UPDATE_USE_CASE_NAME} deps`,
    answers: {
      packageName: DEMO_APPLICATION,
      useCaseName: UPDATE_USE_CASE_NAME,
      portApplicationPackage: DEMO_APPLICATION,
      portFileName: "ticket.repository.port.ts",
      portPropertyName: "ticketRepository",
    },
  });
  s.push({
    name: "application-flow",
    note: "EscalateTicket + interaction port",
    answers: {
      packageName: DEMO_APPLICATION,
      flowName: DEMO_FLOW_NAME,
    },
  });
  for (const useCaseName of DEMO_EXTRA_USE_CASES) {
    s.push({
      name: "application-use-case",
      note: `Demo stack: ${useCaseName}UseCase`,
      answers: {
        packageName: DEMO_APPLICATION,
        useCaseName,
      },
    });
  }
  for (const flowName of DEMO_EXTRA_FLOWS) {
    s.push({
      name: "application-flow",
      note: `Demo stack: ${flowName}Flow`,
      answers: {
        packageName: DEMO_APPLICATION,
        flowName,
      },
    });
  }
  s.push({
    name: "__patch_domain_imports__",
    note: "add type-only @domain/entities imports on new use-cases/flows (wiring graph density)",
    run: patchDemoStackDomainImports,
  });
  s.push({
    name: "application-module",
    note: `${DEMO_MODULE_NAME}Module + GetTicketById + ${DEMO_FLOW_NAME}Flow`,
    answers: {
      packageName: DEMO_APPLICATION,
      moduleName: DEMO_MODULE_NAME,
      useCaseBases: [GET_USE_CASE_NAME],
      flowBases: [DEMO_FLOW_NAME],
    },
  });
  s.push({
    name: "application-wire-module",
    note: `Add UpdateTicketUseCase to ${DEMO_MODULE_NAME}Module`,
    answers: {
      packageName: DEMO_APPLICATION,
      moduleFileName: DEMO_MODULE_FILE,
      useCaseBases: [UPDATE_USE_CASE_NAME],
      flowBases: [],
    },
  });
  for (const { modulePascal, useCaseBases, flowBases } of DEMO_EXTRA_MODULES) {
    s.push({
      name: "application-module",
      note: `Demo stack: ${modulePascal}Module`,
      answers: {
        packageName: DEMO_APPLICATION,
        moduleName: modulePascal,
        useCaseBases,
        flowBases,
      },
    });
  }
  s.push({
    name: "infrastructure-driven-adapter-package",
    note: "Persistence-side package (repository adapter target)",
    answers: { name: "demo-support", isRepository: true },
  });
  s.push({
    name: "driven-repository-add-repository",
    note: "Ky + DataLoader TicketRepository",
    answers: {
      applicationPackage: DEMO_APPLICATION,
      portFile: "ticket.repository.port.ts",
      drivenPackage: DEMO_DRIVEN_REPO,
      repositoryBaseName: "",
    },
  });
  s.push({
    name: "driven-repository-add-repository",
    note: "SDK-style TicketSdkRepository (no shared httpClient)",
    answers: {
      applicationPackage: DEMO_APPLICATION,
      portFile: "ticket.repository.port.ts",
      drivenPackage: DEMO_DRIVEN_REPO,
      repositoryBaseName: "TicketSdk",
      useKyHttpClient: false,
    },
  });
  for (const compName of [DEMO_COMPOSITION, DEMO_COMPOSITION_API, DEMO_COMPOSITION_BFF]) {
    s.push({
      name: "composition-package",
      note: `Composition root @composition/${compName}`,
      answers: { name: compName },
    });
  }
  for (const plan of getDemoCompositionWirePlans()) {
    s.push({
      name: "composition-wire-module",
      note: `Wire → @composition/${plan.composition} (${plan.moduleFileName})`,
      answers: {
        compositionPackage: plan.composition,
        applicationPackage: plan.applicationPackage,
        moduleFileName: plan.moduleFileName,
        propertyKey: plan.propertyKey,
      },
    });
  }
  s.push({
    name: "composition-wire-http-client",
    note: `Http client → httpClient in @composition/${DEMO_COMPOSITION}`,
    answers: {
      compositionPackage: DEMO_COMPOSITION,
      propName: "httpClient",
    },
  });
  s.push({
    name: "composition-wire-dataloader-registry",
    note: `DataLoader registry → loaders in @composition/${DEMO_COMPOSITION}`,
    answers: {
      compositionPackage: DEMO_COMPOSITION,
      propName: "loaders",
    },
  });
  s.push({
    name: "__patch_demo_web_repository_wiring__",
    note: `TicketRepository uses request-scoped httpClient/loaders in @composition/${DEMO_COMPOSITION}`,
    run: patchDemoWebRepositoryWiring,
  });
  s.push({
    name: "__demo_app_shell__",
    note: `apps/${DEMO_APP_STACK_SHELL} (imports all 3 composition roots for graph)`,
    run: ensureDemoStackAppShell,
  });
  s.push({
    name: "__pnpm_install__",
    note: "final pnpm install (include new app + composition packages)",
    run: () => {
      try {
        runDemoPnpmInstall("after demo stack scaffold");
      } catch (e) {
        console.error("[demo] pnpm install failed:", e);
        process.exit(1);
      }
    },
  });
  return s;
}

const STEPS = buildDemoSteps();

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
    "\n[demo] Done\n" +
      "Graphs: pnpm deps:graph:composition (overview) / pnpm deps:graph:composition -- --full (dense) · pnpm deps:graph:module -- packages/application/" +
      DEMO_APPLICATION +
      "/src/modules/support-inbox.module.ts (drill-down) · pnpm deps:graph\n" +
      "Tune demo HTTP base URL in packages/composition/" +
      DEMO_COMPOSITION +
      "/src/infrastructure.ts when wiring a real backend."
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[demo] Fatal:", err);
    process.exit(1);
  });
}
