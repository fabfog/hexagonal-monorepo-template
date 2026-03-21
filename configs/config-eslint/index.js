import path from "node:path";
import { fileURLToPath } from "node:url";
import eslint from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(dirname, "..", "..");

/** Domain file kinds (order: specific paths before catch-all `domain`) */
const domainLayerTypes = [
  "domain-errors",
  "domain-value-objects",
  "domain-entities",
  "domain-services",
  "domain",
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
          type: "domain",
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
          type: "application",
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
          type: "infrastructure",
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
          type: "presentation",
          pattern: "packages/presentation/**",
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
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          rules: [
            ...domainLayerTypes.map((type) => ({
              from: { type },
              disallow: {
                to: [
                  { type: "application" },
                  { type: "infrastructure" },
                  { type: "apps" },
                  { type: "composition" },
                  { type: "presentation" },
                ],
              },
            })),
            {
              from: { type: "infrastructure-driven-repository" },
              disallow: {
                to: [
                  { type: "application-use-cases" },
                  { type: "application-flows" },
                  { type: "infrastructure-driven" },
                  { type: "infrastructure-driven-repository" },
                  { type: "apps" },
                  { type: "composition" },
                  { type: "presentation" },
                  // Repository adapters may import domain entities; not domain services / stray domain files
                  { type: "domain-services" },
                  { type: "domain" },
                ],
              },
            },
            {
              from: { type: "infrastructure-driven" },
              disallow: {
                to: [
                  { type: "application-use-cases" },
                  { type: "application-flows" },
                  { type: "infrastructure-driven" },
                  { type: "infrastructure-driven-repository" },
                  { type: "apps" },
                  { type: "composition" },
                  { type: "presentation" },
                  // Non-repository driven: domain only via errors + value-objects
                  { type: "domain-entities" },
                  { type: "domain-services" },
                  { type: "domain" },
                ],
              },
            },
            {
              from: { type: "infrastructure-lib" },
              disallow: {
                to: [
                  { type: "application-use-cases" },
                  { type: "application-flows" },
                  { type: "infrastructure-driven" },
                  { type: "infrastructure-driven-repository" },
                  { type: "apps" },
                  { type: "composition" },
                  { type: "presentation" },
                ],
              },
            },
            {
              from: { type: "composition" },
              disallow: {
                to: [{ type: "apps" }, { type: "presentation" }],
              },
            },
            {
              from: { type: "apps" },
              disallow: {
                to: [
                  ...domainLayerTypes.map((type) => ({ type })),
                  { type: "application-use-cases" },
                  { type: "application-flows" },
                  { type: "infrastructure" },
                ],
              },
            },
            {
              from: { type: "presentation" },
              disallow: {
                to: [
                  { type: "application" },
                  { type: "infrastructure" },
                  { type: "apps" },
                  { type: "composition" },
                ],
              },
            },
          ],
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
