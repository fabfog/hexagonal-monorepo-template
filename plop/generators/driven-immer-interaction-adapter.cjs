const fs = require("fs");
const path = require("path");
const {
  getRepoRoot,
  toKebabCase,
  toPascalCase,
  parseInterfaceMethods,
  getApplicationPackageChoices,
  getInteractionPortChoices,
  getDrivenInfrastructurePackageChoices,
  readApplicationPortSource,
} = require("../lib");
const {
  parseImmerInteractionAdapterMeta,
  mergeImmerInteractionAdapterFile,
  buildStateInterfaceDeclaration,
  renderMethodImplementation,
} = require("../lib/merge-immer-interaction-adapter.cjs");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDrivenImmerInteractionAdapterGenerator(plop) {
  plop.setGenerator("driven-immer-interaction-adapter", {
    description:
      "Create or update an Immer-based InteractionPort adapter in a driven-* package (merges missing methods)",
    prompts: [
      {
        type: "list",
        name: "applicationPackage",
        message: "Select application package (source InteractionPort):",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "portFile",
        message: "Select InteractionPort (from src/ports/*.interaction.port.ts):",
        choices: (answers) => {
          const ports = getInteractionPortChoices(repoRoot, answers.applicationPackage);
          if (!ports.length) {
            throw new Error(
              `No InteractionPort (*.interaction.port.ts) found in application package "${answers.applicationPackage}".`
            );
          }
          return ports;
        },
      },
      {
        type: "list",
        name: "drivenPackage",
        message: "Select driven-* infrastructure package (target for adapter):",
        choices: getDrivenInfrastructurePackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "adapterBaseName",
        message:
          "Adapter base name (e.g. Editor). Leave empty to derive from InteractionPort name:",
      },
      {
        type: "checkbox",
        name: "askMethodNames",
        when: (answers) => {
          const portSource = readApplicationPortSource(
            repoRoot,
            answers.applicationPackage,
            answers.portFile
          );
          const base = answers.portFile.replace(/\.interaction\.port\.ts$/, "");
          const interfaceName = `${toPascalCase(base)}InteractionPort`;
          const methods = parseInterfaceMethods(portSource, interfaceName);
          return methods.some((m) => /^Promise\s*</.test(m.returnType));
        },
        message:
          "Which port methods use the ask pattern (Promise + currentInteraction, type = method name)? Only Promise<…> methods are listed; others stay as Not implemented stubs.",
        choices: (answers) => {
          const portSource = readApplicationPortSource(
            repoRoot,
            answers.applicationPackage,
            answers.portFile
          );
          const base = answers.portFile.replace(/\.interaction\.port\.ts$/, "");
          const interfaceName = `${toPascalCase(base)}InteractionPort`;
          const methods = parseInterfaceMethods(portSource, interfaceName);
          return methods
            .filter((m) => /^Promise\s*</.test(m.returnType))
            .map((m) => ({
              name: `${m.name}(${m.params}): ${m.returnType}`,
              value: m.name,
              checked: false,
            }));
        },
      },
    ],
    actions: (data) => {
      const { applicationPackage, portFile, drivenPackage, adapterBaseName, askMethodNames } = data;

      const askSet = new Set(Array.isArray(askMethodNames) ? askMethodNames : []);

      const portSource = readApplicationPortSource(repoRoot, applicationPackage, portFile);

      const base = portFile.replace(/\.interaction\.port\.ts$/, "");
      const pascalBase = toPascalCase(base);
      const interfaceName = `${pascalBase}InteractionPort`;

      const methods = parseInterfaceMethods(portSource, interfaceName);
      if (!methods.length) {
        throw new Error(
          `No methods found in InteractionPort interface ${interfaceName} (file ${portFile}).`
        );
      }

      for (const name of askSet) {
        const m = methods.find((x) => x.name === name);
        if (!m || !/^Promise\s*</.test(m.returnType)) {
          throw new Error(
            `Invalid ask selection "${name}": must be a port method that returns Promise<…>.`
          );
        }
      }

      const inferredBase =
        adapterBaseName && adapterBaseName.trim() ? adapterBaseName.trim() : pascalBase;
      const classBase = toPascalCase(inferredBase);
      const className = `Immer${classBase}InteractionAdapter`;
      const fileBase = `immer-${toKebabCase(inferredBase)}.interaction-adapter`;
      const hasAnyAsk = askSet.size > 0;

      const stateInterfaceName = `${classBase}State`;
      const storeTypeName = `${classBase}Store`;

      let methodsCode = "";
      for (const m of methods) {
        methodsCode += renderMethodImplementation(m, askSet);
      }

      const stateDecl = buildStateInterfaceDeclaration(stateInterfaceName, hasAnyAsk);
      const adapterSource = `import type { ${interfaceName} } from '@application/${applicationPackage}/ports';
import { createImmerStore, type ExternalStore } from '@infrastructure/lib-react-immer-store';

${stateDecl}
export type ${storeTypeName} = ExternalStore<${stateInterfaceName}>;

export function get${classBase}Store(initialState: ${stateInterfaceName}): ${storeTypeName} {
  return createImmerStore<${stateInterfaceName}>(initialState);
}

export class ${className} implements ${interfaceName} {
  constructor(public store: ${storeTypeName}) {}
${methodsCode}}\n`;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      const adapterRelPath = `../packages/infrastructure/${drivenPackage}/src/interaction-adapters/${fileBase}.ts`;
      const adapterAbsPath = path.join(
        repoRoot,
        "packages",
        "infrastructure",
        drivenPackage,
        "src",
        "interaction-adapters",
        `${fileBase}.ts`
      );

      if (fs.existsSync(adapterAbsPath)) {
        actions.push({
          type: "modify",
          path: adapterRelPath,
          transform: (content) => {
            const meta = parseImmerInteractionAdapterMeta(content);
            if (meta.className !== className || meta.interfaceName !== interfaceName) {
              throw new Error(
                `Existing file declares ${meta.className} implements ${meta.interfaceName}, but this run targets ${className} / ${interfaceName}. Use the same adapter base name (and port) as when the file was created, or remove the file to regenerate.`
              );
            }
            return mergeImmerInteractionAdapterFile(content, {
              stateInterfaceName: meta.stateInterfaceName,
              className: meta.className,
              interfaceName: meta.interfaceName,
              methods,
              askMethodNames: askSet,
            });
          },
        });
      } else {
        actions.push({
          type: "add",
          path: adapterRelPath,
          template: adapterSource,
        });
      }

      // Ensure interaction-adapters index exists
      actions.push({
        type: "add",
        path: `../packages/infrastructure/${drivenPackage}/src/interaction-adapters/index.ts`,
        template: "export {};\n",
        skipIfExists: true,
      });

      // Update interaction-adapters index
      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${drivenPackage}/src/interaction-adapters/index.ts`,
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${fileBase}';`;

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const baseContent = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${baseContent}${exportLine}\n`;
        },
      });

      // Ensure driven package index exports from interaction-adapters
      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${drivenPackage}/src/index.ts`,
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = "export * from './interaction-adapters';";

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const baseContent = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${baseContent}${exportLine}\n`;
        },
      });

      // Ensure driven package depends on the selected application package
      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${drivenPackage}/package.json`,
        transform: (file) => {
          const pkg = JSON.parse(file);
          const appDepName = `@application/${applicationPackage}`;

          pkg.dependencies = pkg.dependencies || {};

          if (!pkg.dependencies[appDepName]) {
            pkg.dependencies[appDepName] = "workspace:*";
          }

          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      // Ensure driven package depends on lib-react-immer-store
      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${drivenPackage}/package.json`,
        transform: (file) => {
          const pkg = JSON.parse(file);
          const libDepName = "@infrastructure/lib-react-immer-store";

          pkg.dependencies = pkg.dependencies || {};

          if (!pkg.dependencies[libDepName]) {
            pkg.dependencies[libDepName] = "workspace:*";
          }

          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      return actions;
    },
  });
};
