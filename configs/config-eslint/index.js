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

/** Application orchestration / wiring slices infrastructure must not depend on. */
const applicationOrchestrationSlices = [
  "application-use-cases",
  "application-flows",
  "application-modules",
  "application-ports",
  "application-mappers",
];

/** Application slices (specific paths before `application-other`). */
const applicationElementTypes = [
  "application-dtos",
  "application-other",
  ...applicationOrchestrationSlices,
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
          default: "allow",
          rules: [
            ...domainElementTypes.map((type) => ({
              from: { type },
              disallow: {
                to: [
                  ...applicationElementTypes.map((t) => ({ type: t })),
                  ...infrastructureElementTypes.map((t) => ({ type: t })),
                  { type: "apps" },
                  { type: "composition" },
                  { type: "ui" },
                ],
              },
            })),
            {
              from: { type: "infrastructure-driven-repository" },
              disallow: {
                to: [
                  ...applicationOrchestrationSlices.map((t) => ({ type: t })),
                  { type: "infrastructure-driven" },
                  { type: "infrastructure-driven-repository" },
                  { type: "apps" },
                  { type: "composition" },
                  { type: "ui" },
                  // Repository adapters may import domain entities; not domain services / stray domain files
                  { type: "domain-services" },
                  { type: "domain-utils" },
                  { type: "domain-other" },
                ],
              },
            },
            {
              from: { type: "infrastructure-driven" },
              disallow: {
                to: [
                  ...applicationOrchestrationSlices.map((t) => ({ type: t })),
                  { type: "infrastructure-driven" },
                  { type: "infrastructure-driven-repository" },
                  { type: "apps" },
                  { type: "composition" },
                  { type: "ui" },
                  // Non-repository driven: domain only via errors + value-objects
                  { type: "domain-entities" },
                  { type: "domain-services" },
                  { type: "domain-utils" },
                  { type: "domain-other" },
                ],
              },
            },
            {
              from: { type: "infrastructure-lib" },
              disallow: {
                to: [
                  ...applicationOrchestrationSlices.map((t) => ({ type: t })),
                  { type: "infrastructure-driven" },
                  { type: "infrastructure-driven-repository" },
                  { type: "apps" },
                  { type: "composition" },
                  { type: "ui" },
                ],
              },
            },
            {
              from: { type: "infrastructure-other" },
              disallow: {
                to: [
                  ...applicationOrchestrationSlices.map((t) => ({ type: t })),
                  { type: "infrastructure-driven" },
                  { type: "infrastructure-driven-repository" },
                  { type: "apps" },
                  { type: "composition" },
                  { type: "ui" },
                ],
              },
            },
            {
              from: { type: "composition" },
              disallow: {
                to: [{ type: "apps" }, { type: "ui" }],
              },
            },
            {
              from: { type: "apps" },
              disallow: {
                to: [
                  ...domainElementTypes.map((type) => ({ type })),
                  ...applicationOrchestrationSlices.map((type) => ({ type })),
                  ...infrastructureElementTypes.map((type) => ({ type })),
                ],
              },
            },
            {
              from: { type: "ui" },
              disallow: {
                to: [
                  ...domainElementTypes.map((type) => ({ type })),
                  ...applicationOrchestrationSlices.map((type) => ({ type })),
                  { type: "application-other" },
                  ...infrastructureElementTypes.map((type) => ({ type })),
                  { type: "apps" },
                  { type: "composition" },
                ],
              },
            },
            // Only composition may depend on `src/modules` (public `@application/*/modules` entry).
            {
              from: { type: "application-dtos" },
              disallow: { to: [{ type: "application-modules" }] },
            },
            {
              from: { type: "application-use-cases" },
              disallow: { to: [{ type: "application-modules" }] },
            },
            {
              from: { type: "application-flows" },
              disallow: { to: [{ type: "application-modules" }] },
            },
            {
              from: { type: "application-ports" },
              disallow: { to: [{ type: "application-modules" }] },
            },
            {
              from: { type: "application-mappers" },
              disallow: { to: [{ type: "application-modules" }] },
            },
            {
              from: { type: "application-other" },
              disallow: { to: [{ type: "application-modules" }] },
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
