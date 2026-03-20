const fs = require("fs");
const path = require("path");
const { getRepoRoot, toKebabCase, toPascalCase, parseInterfaceMethods } = require("../lib");

const repoRoot = getRepoRoot();

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

function getNormalPorts(appPackage) {
  const portsDir = path.join(repoRoot, "packages", "application", appPackage, "src", "ports");
  if (!fs.existsSync(portsDir)) {
    return [];
  }

  return fs
    .readdirSync(portsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".port.ts") &&
        !entry.name.endsWith(".interaction.port.ts")
    )
    .map((entry) => {
      const base = entry.name.replace(/\.port\.ts$/, "");
      const pascal = toPascalCase(base);
      const interfaceName = `${pascal}Port`;
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

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDrivenPortAdapterGenerator(plop) {
  plop.setGenerator("driven-port-adapter", {
    description: "Create a concrete adapter for a normal Port in a driven-* infrastructure package",
    prompts: [
      {
        type: "list",
        name: "applicationPackage",
        message: "Select application package (source Port):",
        choices: getApplicationPackageChoices(),
      },
      {
        type: "list",
        name: "portFile",
        message: "Select Port (from src/ports/*.port.ts, excluding InteractionPort):",
        choices: (answers) => {
          const ports = getNormalPorts(answers.applicationPackage);
          if (!ports.length) {
            throw new Error(
              `No normal Port (*.port.ts) found in application package "${answers.applicationPackage}".`
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
        message: "Adapter base name (e.g. EditorRepository). Leave empty to derive from Port name:",
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

      const base = portFile.replace(/\.port\.ts$/, "");
      const pascalBase = toPascalCase(base);
      const interfaceName = `${pascalBase}Port`;
      const methods = parseInterfaceMethods(portSource, interfaceName);

      if (!methods.length) {
        throw new Error(`No methods found in Port interface ${interfaceName} (file ${portFile}).`);
      }

      const inferredBase =
        adapterBaseName && adapterBaseName.trim() ? adapterBaseName.trim() : pascalBase;
      const classBase = toPascalCase(inferredBase);
      const className = `${classBase}Adapter`;
      const fileBase = `${toKebabCase(inferredBase)}.adapter`;

      let methodsCode = "";
      for (const { name, params, returnType } of methods) {
        methodsCode += `\n  ${name}(${params}): ${returnType} {\n    throw new Error("Not implemented!");\n  }\n`;
      }

      const adapterSource = `import type { ${interfaceName} } from '@application/${applicationPackage}/ports';

export class ${className} implements ${interfaceName} {
${methodsCode}}\n`;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      actions.push({
        type: "add",
        path: `../packages/infrastructure/${drivenPackage}/src/adapters/${fileBase}.ts`,
        template: adapterSource,
      });

      actions.push({
        type: "add",
        path: `../packages/infrastructure/${drivenPackage}/src/adapters/index.ts`,
        template: "export {};\n",
        skipIfExists: true,
      });

      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${drivenPackage}/src/adapters/index.ts`,
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${fileBase}';`;

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const content = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${content}${exportLine}\n`;
        },
      });

      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${drivenPackage}/src/index.ts`,
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = "export * from './adapters';";

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const content = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${content}${exportLine}\n`;
        },
      });

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

      return actions;
    },
  });
};
