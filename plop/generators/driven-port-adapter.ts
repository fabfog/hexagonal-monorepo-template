import type { NodePlopAPI } from "node-plop";
import fs from "node:fs";
import path from "node:path";
import { mergeAdapterContent } from "../lib/merge-driven-port-adapter.ts";
import type { Answers } from "inquirer";
import {
  getRepoRoot,
  toKebabCase,
  toPascalCase,
  parseInterfaceMethods,
  getApplicationPackageChoices,
  getNormalPortChoices,
  getDrivenInfrastructurePackageChoices,
  readApplicationPortSource,
} from "../lib/index.ts";
const repoRoot = getRepoRoot();
export default function registerDrivenPortAdapterGenerator(plop: NodePlopAPI) {
  plop.setGenerator("driven-port-adapter", {
    description:
      "Create or update a concrete adapter for a normal Port in a driven-* package (new file, or merge missing method stubs only)",
    prompts: [
      {
        type: "list",
        name: "applicationPackage",
        message: "Select application package (source Port):",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "portFile",
        message:
          "Select Port (from src/ports/*.port.ts, excluding InteractionPort and *.repository.port.ts):",
        choices: (answers: Answers) => {
          const ports = getNormalPortChoices(repoRoot, answers.applicationPackage);
          if (!ports.length) {
            throw new Error(
              `No normal Port (*.port.ts, excluding repository ports) found in application package "${answers.applicationPackage}".`
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
        message: "Adapter base name (e.g. EditorRepository). Leave empty to derive from Port name:",
      },
    ],
    actions: (data?: Answers) => {
      if (!data) return [];
      const { applicationPackage, portFile, drivenPackage, adapterBaseName } = data;
      const portSource = readApplicationPortSource(repoRoot, applicationPackage, portFile);
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
      /** @type {import('node-plop').ActionType[]} */
      const actions = [];
      const adapterRelPath = `../packages/infrastructure/${drivenPackage}/src/adapters/${fileBase}.ts`;
      const adapterAbsPath = path.join(
        repoRoot,
        "packages",
        "infrastructure",
        drivenPackage,
        "src",
        "adapters",
        `${fileBase}.ts`
      );
      if (fs.existsSync(adapterAbsPath)) {
        actions.push({
          type: "modify",
          path: adapterRelPath,
          transform: (content: string) =>
            mergeAdapterContent(content, { className, interfaceName, methods }),
        });
      } else {
        actions.push({
          type: "add",
          path: adapterRelPath,
          template: adapterSource,
        });
      }
      actions.push({
        type: "add",
        path: `../packages/infrastructure/${drivenPackage}/src/adapters/index.ts`,
        template: "export {};\n",
        skipIfExists: true,
      });
      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${drivenPackage}/src/adapters/index.ts`,
        transform: (file: string) => {
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
        transform: (file: string) => {
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
        transform: (file: string) => {
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
}
