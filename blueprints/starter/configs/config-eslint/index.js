import path from "node:path";
import { fileURLToPath } from "node:url";
import eslint from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(dirname, "..", "..");

const domainElementTypes = [
  "domain-errors",
  "domain-value-objects",
  "domain-entities",
  "domain-services",
  "domain-utils",
  "domain-other",
];

const applicationNonOrchestrationSlices = [
  "application-dtos",
  "application-interaction-ports",
  "application-ports",
  "application-mappers",
  "application-other",
];

const applicationElementTypes = [
  "application-use-cases",
  "application-flows",
  "application-modules",
  ...applicationNonOrchestrationSlices,
];

const applicationAllowTo = [
  ...domainElementTypes.map((t) => ({ type: t })),
  ...applicationNonOrchestrationSlices.map((t) => ({ type: t })),
];

const infrastructureElementTypes = [
  "infrastructure-driven-repository",
  "infrastructure-driven",
  "infrastructure-lib",
  "infrastructure-other",
];

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
        { type: "domain-errors", pattern: "packages/domain/**/src/errors/**" },
        { type: "domain-value-objects", pattern: "packages/domain/**/src/value-objects/**" },
        { type: "domain-entities", pattern: "packages/domain/**/src/entities/**" },
        { type: "domain-services", pattern: "packages/domain/**/src/services/**" },
        { type: "domain-utils", pattern: "packages/domain/**/src/utils/**" },
        { type: "domain-other", pattern: "packages/domain/**" },
        { type: "application-dtos", pattern: "packages/application/**/src/dtos/**" },
        { type: "application-use-cases", pattern: "packages/application/**/src/use-cases/**" },
        { type: "application-flows", pattern: "packages/application/**/src/flows/**" },
        { type: "application-modules", pattern: "packages/application/**/src/modules/**" },
        {
          type: "application-interaction-ports",
          pattern: "packages/application/**/src/ports/*.interaction.port.*",
        },
        { type: "application-ports", pattern: "packages/application/**/src/ports/**" },
        { type: "application-mappers", pattern: "packages/application/**/src/mappers/**" },
        { type: "application-other", pattern: "packages/application/**" },
        {
          type: "infrastructure-driven-repository",
          pattern: "packages/infrastructure/driven-repository-**",
        },
        { type: "infrastructure-driven", pattern: "packages/infrastructure/driven-**" },
        { type: "infrastructure-lib", pattern: "packages/infrastructure/lib-**" },
        { type: "infrastructure-other", pattern: "packages/infrastructure/**" },
        { type: "composition", pattern: "packages/composition/**" },
        { type: "apps", pattern: "apps/**" },
        { type: "ui", pattern: "packages/ui/**" },
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
                "Do not import from filesystem paths under `packages/...`. Use workspace package aliases/exports.",
            },
          ],
        },
      ],
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules: [
            ...domainElementTypes.map((type) => ({
              from: { type },
              allow: { to: domainElementTypes.map((t) => ({ type: t })) },
            })),
            ...applicationElementTypes
              .filter((t) => t !== "application-modules")
              .map((type) => ({
                from: { type },
                allow: { to: applicationAllowTo },
              })),
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
            "Do not use `process` in domain or application packages; inject platform concerns externally.",
        },
        {
          name: "globalThis",
          message:
            "Do not use `globalThis` in domain or application packages; keep code free of global runtime access.",
        },
      ],
    },
  },
  prettierConfig,
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);

export default config;
