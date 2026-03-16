import path from "node:path";
import { fileURLToPath } from "node:url";
import eslint from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(dirname, "..", "..");

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
          type: "domain",
          pattern: "packages/domain/**",
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
          type: "infrastructure-driven",
          pattern: "packages/infrastructure/driven-**",
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
            {
              from: { type: "domain" },
              disallow: {
                to: { type: "application" },
              },
            },
            {
              from: { type: "infrastructure-driven" },
              disallow: {
                to: [{ type: "application-use-cases" }, { type: "application-flows" }],
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
