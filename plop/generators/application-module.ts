import type { NodePlopAPI } from "node-plop";
import fs from "node:fs";
import path from "node:path";
import { ensureApplicationPackageSlice } from "../lib/ensure-package-slice.ts";
import {
  getRepoRoot,
  getApplicationPackageChoices,
  getApplicationUseCaseCheckboxChoices,
  getApplicationFlowCheckboxChoices,
  packagePath,
  toKebabCase,
  toPascalCase,
} from "../lib/index.ts";
import type { Answers } from "inquirer";
import {
  extractWireSpec,
  buildWiredModuleSource,
  buildEmptyModuleSource,
} from "../lib/module-wire-ast.ts";
const repoRoot = getRepoRoot();
export default function registerApplicationModuleGenerator(plop: NodePlopAPI) {
  plop.setGenerator("application-module", {
    description:
      "Add a composition-facing Module class (+ Infra interface) under src/modules/, wiring use-cases/flows as camelCase() factories (private readonly infra; flows take interaction ports as method args)",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select application package:",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "moduleName",
        message: "Module name:",
        validate: (value: unknown) =>
          String(value || "").trim().length > 0 || "Name cannot be empty",
        filter: (value: unknown) => String(value || "").trim(),
      },
      {
        type: "checkbox",
        name: "useCaseBases",
        message: "Use cases to wire (optional):",
        choices: (answers: Answers) =>
          getApplicationUseCaseCheckboxChoices(repoRoot, answers.packageName),
      },
      {
        type: "checkbox",
        name: "flowBases",
        message: "Flows to wire (optional):",
        choices: (answers: Answers) =>
          getApplicationFlowCheckboxChoices(repoRoot, answers.packageName),
      },
    ],
    actions: (data?: Answers) => {
      if (!data) return [];
      const { packageName, moduleName } = data;
      const kebab = toKebabCase(moduleName);
      const modulePascal = toPascalCase(moduleName);
      const baseFile = `${kebab}.module`;
      const useCaseBases = data.useCaseBases || [];
      const flowBases = data.flowBases || [];
      /** @type {import('node-plop').ActionType[]} */
      const actions = [];
      actions.push(() => {
        ensureApplicationPackageSlice(repoRoot, packageName, "modules");
        return "";
      });
      actions.push(() => {
        const specs = [];
        const ucRoot = packagePath(repoRoot, "application", packageName, "src", "use-cases");
        for (const base of useCaseBases) {
          const filePath = path.join(ucRoot, `${toKebabCase(base)}.use-case.ts`);
          specs.push(extractWireSpec(filePath, "use-case", base));
        }
        const flowsRoot = packagePath(repoRoot, "application", packageName, "src", "flows");
        for (const base of flowBases) {
          const filePath = path.join(flowsRoot, `${toKebabCase(base)}.flow.ts`);
          specs.push(extractWireSpec(filePath, "flow", base));
        }
        const content =
          specs.length === 0
            ? buildEmptyModuleSource(modulePascal)
            : buildWiredModuleSource({ modulePascal, specs });
        const outDir = packagePath(repoRoot, "application", packageName, "src", "modules");
        const outPath = path.join(outDir, `${kebab}.module.ts`);
        if (fs.existsSync(outPath)) {
          throw new Error(`Module file already exists: ${path.relative(repoRoot, outPath)}`);
        }
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outPath, `${content.replace(/\n+$/, "")}\n`, "utf8");
        return `Created ${path.relative(repoRoot, outPath)}`;
      });
      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/src/modules/index.ts",
        transform: (file: string) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${baseFile}';`;
          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }
          const base = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${base}${exportLine}\n`;
        },
      });
      return actions;
    },
  });
}
