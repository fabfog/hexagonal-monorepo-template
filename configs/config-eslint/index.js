import path from "node:path";
import { fileURLToPath } from "node:url";
import eslint from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(dirname, "..", "..");

/** Domain slices (order matches `boundaries/elements`: specific before catch-all). */
const domainElementTypes = [
  "domain-errors",
  "domain-value-objects",
  "domain-entities",
  "domain-services",
  "domain-utils",
  "domain-other",
];

/**
 * Application slices that are NOT orchestration.
 * Used in allow rules: every application slice (orchestration or not) may import these,
 * but orchestration slices are excluded — they can only be composed externally.
 */
const applicationNonOrchestrationSlices = [
  "application-dtos",
  "application-interaction-ports",
  "application-ports",
  "application-mappers",
  "application-other",
];

/** All Application slices (specific paths before `application-other`).
 * NOTE: `application-interaction-ports` must come before `application-ports` so the
 * more-specific glob wins first-match in boundaries/elements. */
const applicationElementTypes = [
  "application-use-cases",
  "application-flows",
  "application-modules",
  ...applicationNonOrchestrationSlices,
];

/** What any application slice may import: full domain + non-orchestration application only. */
const applicationAllowTo = [
  ...domainElementTypes.map((t) => ({ type: t })),
  ...applicationNonOrchestrationSlices.map((t) => ({ type: t })),
];

/** Infrastructure package kinds (specific before `infrastructure-other`). */
const infrastructureElementTypes = [
  "infrastructure-driven-repository",
  "infrastructure-driven",
  "infrastructure-lib",
  "infrastructure-other",
];

/** @type {import('eslint').Linter.Config[]} */
const config = defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "writable",
      },
    },
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        {
          type: "domain-errors",
          pattern: "packages/domain/**/src/errors/**",
        },
        {
          type: "domain-value-objects",
          pattern: "packages/domain/**/src/value-objects/**",
        },
        {
          type: "domain-entities",
          pattern: "packages/domain/**/src/entities/**",
        },
        {
          type: "domain-services",
          pattern: "packages/domain/**/src/services/**",
        },
        {
          type: "domain-utils",
          pattern: "packages/domain/**/src/utils/**",
        },
        {
          type: "domain-other",
          pattern: "packages/domain/**",
        },
        {
          type: "application-dtos",
          pattern: "packages/application/**/src/dtos/**",
        },
        {
          type: "application-use-cases",
          pattern: "packages/application/**/src/use-cases/**",
        },
        {
          type: "application-flows",
          pattern: "packages/application/**/src/flows/**",
        },
        {
          type: "application-modules",
          pattern: "packages/application/**/src/modules/**",
        },
        {
          type: "application-interaction-ports",
          pattern: "packages/application/**/src/ports/*.interaction.port.*",
        },
        {
          type: "application-ports",
          pattern: "packages/application/**/src/ports/**",
        },
        {
          type: "application-mappers",
          pattern: "packages/application/**/src/mappers/**",
        },
        {
          type: "application-other",
          pattern: "packages/application/**",
        },
        {
          type: "infrastructure-driven-repository",
          pattern: "packages/infrastructure/driven-repository-**",
        },
        {
          type: "infrastructure-driven",
          pattern: "packages/infrastructure/driven-**",
        },
        {
          type: "infrastructure-lib",
          pattern: "packages/infrastructure/lib-**",
        },
        {
          type: "infrastructure-other",
          pattern: "packages/infrastructure/**",
        },
        {
          type: "composition",
          pattern: "packages/composition/**",
        },
        {
          type: "apps",
          pattern: "apps/**",
        },
        {
          type: "ui",
          pattern: "packages/ui/**",
        },
      ],
      "import/resolver": {
        typescript: {
          project: [path.join(repoRoot, "tsconfig.repo.json")],
        },
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["packages/*", "packages/*/*", "packages/*/*/*"],
              message:
                "Do not import from filesystem paths under `packages/...`. Use workspace package aliases/exports (e.g. `@application/*`, `@domain/*`, `@composition/*`).",
            },
          ],
        },
      ],
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules: [
            // ── Domain ──────────────────────────────────────────────────────
            // Domain is self-contained: any domain slice may import any other domain slice.
            ...domainElementTypes.map((type) => ({
              from: { type },
              allow: { to: domainElementTypes.map((t) => ({ type: t })) },
            })),

            // ── Application: use-cases, flows, and non-orchestration slices ──
            // May import: all domain types + non-orchestration application types
            // (dtos, ports, mappers, other).
            // Use-cases and flows are intentionally absent from this list so they
            // cannot call each other directly — cross-slice orchestration happens in modules.
            ...applicationElementTypes
              .filter((t) => t !== "application-modules")
              .map((type) => ({
                from: { type },
                allow: { to: applicationAllowTo },
              })),

            // ── Application: modules ─────────────────────────────────────────
            // Modules wire use-cases and flows together (import their types for DI).
            // They may NOT import other modules — module composition happens in composition.
            {
              from: { type: "application-modules" },
              allow: {
                to: [
                  ...applicationAllowTo,
                  { type: "application-use-cases" },
                  { type: "application-flows" },
                ],
              },
            },

            // ── Infrastructure: driven-repository ────────────────────────────
            // May touch domain entities (for mapping) + errors/VOs,
            // application contracts (ports/dtos), and lib/other infra.
            {
              from: { type: "infrastructure-driven-repository" },
              allow: {
                to: [
                  { type: "domain-errors" },
                  { type: "domain-value-objects" },
                  { type: "domain-entities" },
                  { type: "application-dtos" },
                  { type: "application-interaction-ports" },
                  { type: "application-ports" },
                  { type: "application-other" },
                  { type: "infrastructure-lib" },
                  { type: "infrastructure-other" },
                ],
              },
            },

            // ── Infrastructure: driven (non-repository) ──────────────────────
            // Narrower domain access than repository: only errors + VOs (no entities).
            {
              from: { type: "infrastructure-driven" },
              allow: {
                to: [
                  { type: "domain-errors" },
                  { type: "domain-value-objects" },
                  { type: "application-dtos" },
                  { type: "application-interaction-ports" },
                  { type: "application-ports" },
                  { type: "application-other" },
                  { type: "infrastructure-lib" },
                  { type: "infrastructure-other" },
                ],
              },
            },

            // ── Infrastructure: lib / other ──────────────────────────────────
            // Generic infra utilities: full domain access + application contracts + lib/other infra.
            ...["infrastructure-lib", "infrastructure-other"].map((type) => ({
              from: { type },
              allow: {
                to: [
                  ...domainElementTypes.map((t) => ({ type: t })),
                  { type: "application-dtos" },
                  { type: "application-interaction-ports" },
                  { type: "application-ports" },
                  { type: "application-other" },
                  { type: "infrastructure-lib" },
                  { type: "infrastructure-other" },
                ],
              },
            })),

            // ── Composition ──────────────────────────────────────────────────
            // The wiring layer: may import from any layer except apps and ui.
            {
              from: { type: "composition" },
              allow: {
                to: [
                  ...domainElementTypes.map((t) => ({ type: t })),
                  ...applicationElementTypes.map((t) => ({ type: t })),
                  ...infrastructureElementTypes.map((t) => ({ type: t })),
                ],
              },
            },

            // ── Apps ─────────────────────────────────────────────────────────
            // Runnable apps: only composition (wiring) + application DTOs and
            // interaction ports (InteractionPort types for UI-driven flows) + ui packages.
            {
              from: { type: "apps" },
              allow: {
                to: [
                  { type: "application-dtos" },
                  { type: "application-interaction-ports" },
                  { type: "composition" },
                  { type: "ui" },
                ],
              },
            },

            // ── UI ───────────────────────────────────────────────────────────
            // View packages: data flows in through composition props; no direct layer imports.
            // Only exception: ui may import other ui packages (e.g. ui-icons → ui-react).
            {
              from: { type: "ui" },
              allow: { to: [{ type: "ui" }] },
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "packages/domain/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
      "packages/application/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "process",
          message:
            "Do not use `process` in domain or application packages; inject Node/platform concerns from composition or infrastructure.",
        },
        {
          name: "globalThis",
          message:
            "Do not use `globalThis` in domain or application packages; keep code free of global runtime access.",
        },
      ],
    },
  },
  // Disable any formatting rules that could conflict with Prettier
  prettierConfig,
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);

export default config;
