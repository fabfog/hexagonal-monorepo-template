const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");

function toKebabCase(value) {
  return String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function toPascalCase(value) {
  return String(value)
    .trim()
    .split(/[\s\-_/]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function getApplicationPackageChoices() {
  const appRoot = path.join(repoRoot, "packages", "application");
  if (!fs.existsSync(appRoot)) {
    return [];
  }

  return fs
    .readdirSync(appRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "core")
    .map((entry) => ({ name: entry.name, value: entry.name }));
}

function getInteractionPorts(appPackage) {
  const portsDir = path.join(repoRoot, "packages", "application", appPackage, "src", "ports");
  if (!fs.existsSync(portsDir)) {
    return [];
  }

  return fs
    .readdirSync(portsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".interaction.port.ts"))
    .map((entry) => {
      const base = entry.name.replace(/\.interaction\.port\.ts$/, "");
      const pascal = toPascalCase(base);
      const interfaceName = `${pascal}InteractionPort`;
      return {
        name: `${interfaceName} (${entry.name})`,
        value: entry.name,
      };
    });
}

function getDrivenInfrastructureChoices() {
  const infraRoot = path.join(repoRoot, "packages", "infrastructure");
  if (!fs.existsSync(infraRoot)) {
    return [];
  }

  return fs
    .readdirSync(infraRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("driven-"))
    .map((entry) => ({ name: entry.name, value: entry.name }));
}

function parseInterfaceMethods(source, interfaceName) {
  const ifaceDecl = `export interface ${interfaceName}`;
  const start = source.indexOf(ifaceDecl);
  if (start === -1) {
    throw new Error(`Interface ${interfaceName} not found in port file`);
  }
  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) {
    throw new Error(`Cannot find body for interface ${interfaceName}`);
  }
  let braceDepth = 1;
  let i = braceStart + 1;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    if (braceDepth === 0) break;
  }
  const body = source.slice(braceStart + 1, i);

  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"));

  const methods = [];
  for (const line of lines) {
    const m = line.match(/^(\w+)\(([^)]*)\):\s*([^;{]+);?$/);
    if (!m) continue;
    const [, name, params, returnType] = m;
    methods.push({
      name,
      params: params.trim(),
      returnType: returnType.trim(),
    });
  }
  return methods;
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDrivenImmerInteractionAdapterGenerator(plop) {
  plop.setGenerator("driven-immer-interaction-adapter", {
    description:
      "Create an Immer-based concrete InteractionPort adapter in a driven-* infrastructure package",
    prompts: [
      {
        type: "list",
        name: "applicationPackage",
        message: "Select application package (source InteractionPort):",
        choices: getApplicationPackageChoices(),
      },
      {
        type: "list",
        name: "portFile",
        message: "Select InteractionPort (from src/ports/*.interaction.port.ts):",
        choices: (answers) => {
          const ports = getInteractionPorts(answers.applicationPackage);
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
        choices: getDrivenInfrastructureChoices(),
      },
      {
        type: "input",
        name: "adapterBaseName",
        message:
          "Adapter base name (e.g. Editor). Leave empty to derive from InteractionPort name:",
      },
    ],
    actions: (data) => {
      const { applicationPackage, portFile, drivenPackage, adapterBaseName } = data;

      const portsDir = path.join(
        repoRoot,
        "packages",
        "application",
        applicationPackage,
        "src",
        "ports"
      );
      const portFilePath = path.join(portsDir, portFile);
      const portSource = fs.readFileSync(portFilePath, "utf8");

      const base = portFile.replace(/\.interaction\.port\.ts$/, "");
      const pascalBase = toPascalCase(base);
      const interfaceName = `${pascalBase}InteractionPort`;

      const methods = parseInterfaceMethods(portSource, interfaceName);
      if (!methods.length) {
        throw new Error(
          `No methods found in InteractionPort interface ${interfaceName} (file ${portFile}).`
        );
      }

      const inferredBase =
        adapterBaseName && adapterBaseName.trim() ? adapterBaseName.trim() : pascalBase;
      const classBase = toPascalCase(inferredBase);
      const className = `Immer${classBase}InteractionAdapter`;
      const fileBase = `immer-${toKebabCase(inferredBase)}.interaction-adapter`;

      let methodsCode = "";
      for (const { name, params, returnType } of methods) {
        const fnParams = params || "";
        const ret = returnType || "void";
        methodsCode += `\n  ${name}(${fnParams}): ${ret} {\n    this.store.update((draft) => {\n      throw new Error("Not implemented!");\n    });\n  }\n`;
      }

      const stateInterfaceName = `${classBase}State`;
      const storeTypeName = `${classBase}Store`;
      const adapterSource = `import type { ${interfaceName} } from '@application/${applicationPackage}/ports';
import { createImmerStore, type ExternalStore } from '@infrastructure/lib-react-immer-store';

export interface ${stateInterfaceName} {}

export type ${storeTypeName} = ExternalStore<${stateInterfaceName}>;

export function get${classBase}Store(initialState: ${stateInterfaceName}): ${storeTypeName} {
  return createImmerStore<${stateInterfaceName}>(initialState);
}

export class ${className} implements ${interfaceName} {
  constructor(public store: ${storeTypeName}) {}
${methodsCode}}\n`;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      // Add adapter file under interaction-adapters
      actions.push({
        type: "add",
        path: `../packages/infrastructure/${drivenPackage}/src/interaction-adapters/${fileBase}.ts`,
        template: adapterSource,
      });

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

          const base = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${base}${exportLine}\n`;
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

          const base = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${base}${exportLine}\n`;
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
