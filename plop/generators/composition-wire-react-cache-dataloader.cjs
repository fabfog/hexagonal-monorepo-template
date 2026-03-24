const { getRepoRoot, getCompositionPackageChoices } = require("../lib");

const repoRoot = getRepoRoot();

const SERVER_FILE = `import { cache } from "react";
import { createDataLoaderRegistry } from "@infrastructure/lib-dataloader";

/**
 * DataLoader registry per request (server-only, e.g. Next.js RSC).
 * Each request gets its own instance; multiple calls within the same request
 * receive the same instance.
 */
export const getServerDataLoaderRegistry = cache(createDataLoaderRegistry);
`;

const CLIENT_FILE = `export { createDataLoaderRegistry } from "@infrastructure/lib-dataloader";
`;

/**
 * @param {string} src
 * @param {string} exportLine e.g. 'export { getServerDataLoaderRegistry } from "./get-data-loader-registry";'
 * @param {string} symbolName e.g. 'getServerDataLoaderRegistry' - used to detect if already exported
 */
function ensureExport(src, exportLine, symbolName) {
  if (new RegExp(`export\\s*\\{[^}]*\\b${symbolName}\\b[^}]*\\}`).test(src)) {
    return src;
  }
  const trimmed = src.trimEnd();
  return `${trimmed}\n\n${exportLine}\n`;
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionWireReactCacheDataloaderGenerator(plop) {
  plop.setGenerator("composition-wire-react-cache-dataloader", {
    description:
      "Wire DataLoader registry: server uses react.cache (per-request singleton), client uses plain createDataLoaderRegistry. Adds react + lib-dataloader deps.",
    prompts: [
      {
        type: "list",
        name: "compositionPackage",
        message: "Select composition package:",
        choices: getCompositionPackageChoices(repoRoot),
      },
    ],
    actions: (data) => {
      const { compositionPackage } = data;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      actions.push({
        type: "add",
        path: `../packages/composition/${compositionPackage}/src/server/get-data-loader-registry.ts`,
        template: SERVER_FILE,
        skipIfExists: true,
      });

      actions.push({
        type: "add",
        path: `../packages/composition/${compositionPackage}/src/client/data-loader-registry.ts`,
        template: CLIENT_FILE,
        skipIfExists: true,
      });

      actions.push({
        type: "modify",
        path: `../packages/composition/${compositionPackage}/src/server/index.ts`,
        transform: (file) =>
          ensureExport(
            file,
            'export { getServerDataLoaderRegistry } from "./get-data-loader-registry";',
            "getServerDataLoaderRegistry"
          ),
      });

      actions.push({
        type: "modify",
        path: `../packages/composition/${compositionPackage}/src/client/index.ts`,
        transform: (file) =>
          ensureExport(
            file,
            'export { createDataLoaderRegistry } from "./data-loader-registry";',
            "createDataLoaderRegistry"
          ),
      });

      actions.push({
        type: "modify",
        path: `../packages/composition/${compositionPackage}/package.json`,
        transform: (file) => {
          const pkg = JSON.parse(file);
          pkg.dependencies = pkg.dependencies || {};
          if (!pkg.dependencies["@infrastructure/lib-dataloader"]) {
            pkg.dependencies["@infrastructure/lib-dataloader"] = "workspace:*";
          }
          if (!pkg.dependencies["react"]) {
            pkg.dependencies["react"] = "^19.0.0";
          }
          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      return actions;
    },
  });
};
