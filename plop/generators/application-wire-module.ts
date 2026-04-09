import type { NodePlopAPI } from "node-plop";
import path from "node:path";
import {
  getRepoRoot,
  getApplicationPackageChoices,
  getApplicationModuleFileChoices,
  getApplicationUseCaseCheckboxChoices,
  getApplicationFlowCheckboxChoices,
  packagePath,
  toKebabCase,
} from "../lib/index.ts";
import type { Answers } from "inquirer";
import {
  extractWireSpec,
  getWiredSliceClassNamesFromModule,
  wireAdditionalSlicesIntoModuleFile,
} from "../lib/module-wire-ast.ts";
const repoRoot = getRepoRoot();
/**
 * @param {string} packageName
 * @param {string} moduleFileName
 */
function moduleAbsPath(packageName: string, moduleFileName: string) {
  return path.join(
    repoRoot,
    "packages",
    "application",
    packageName,
    "src",
    "modules",
    moduleFileName
  );
}
export default function registerApplicationWireModuleGenerator(plop: NodePlopAPI) {
  plop.setGenerator("application-wire-module", {
    description:
      "Add use-cases and/or flows to an existing *.module.ts (imports, Infra props, camelCase slice methods, constructor(private readonly infra))",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select application package:",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "moduleFileName",
        message: "Select existing module file:",
        choices: (answers: Answers) => {
          const c = getApplicationModuleFileChoices(repoRoot, answers.packageName);
          return c.length
            ? c
            : [
                {
                  name: "— No *.module.ts — run application-module first —",
                  value: "__none__",
                },
              ];
        },
      },
      {
        type: "checkbox",
        name: "useCaseBases",
        message: "Use cases to add (not yet wired in this module):",
        choices: (answers: Answers) => {
          if (!answers.moduleFileName || answers.moduleFileName === "__none__") {
            return [];
          }
          const wired = getWiredSliceClassNamesFromModule(
            moduleAbsPath(answers.packageName, answers.moduleFileName)
          );
          return getApplicationUseCaseCheckboxChoices(repoRoot, answers.packageName).filter(
            (c) => !wired.has(`${c.value}UseCase`)
          );
        },
      },
      {
        type: "checkbox",
        name: "flowBases",
        message: "Flows to add (not yet wired in this module):",
        choices: (answers: Answers) => {
          if (!answers.moduleFileName || answers.moduleFileName === "__none__") {
            return [];
          }
          const wired = getWiredSliceClassNamesFromModule(
            moduleAbsPath(answers.packageName, answers.moduleFileName)
          );
          return getApplicationFlowCheckboxChoices(repoRoot, answers.packageName).filter(
            (c) => !wired.has(`${c.value}Flow`)
          );
        },
      },
    ],
    actions: [
      (data?: Answers) => {
        if (!data) return "";
        if (data.moduleFileName === "__none__") {
          throw new Error(
            'No module file in this package. Run the "application-module" generator first.'
          );
        }
        const useCaseBases = data.useCaseBases || [];
        const flowBases = data.flowBases || [];
        if (!useCaseBases.length && !flowBases.length) {
          throw new Error(
            "Select at least one use case or flow. If the lists are empty, everything is already wired in this module."
          );
        }
        const modPath = moduleAbsPath(data.packageName, data.moduleFileName);
        const specs = [];
        const ucRoot = packagePath(repoRoot, "application", data.packageName, "src", "use-cases");
        for (const base of useCaseBases) {
          specs.push(
            extractWireSpec(path.join(ucRoot, `${toKebabCase(base)}.use-case.ts`), "use-case", base)
          );
        }
        const flowsRoot = packagePath(repoRoot, "application", data.packageName, "src", "flows");
        for (const base of flowBases) {
          specs.push(
            extractWireSpec(path.join(flowsRoot, `${toKebabCase(base)}.flow.ts`), "flow", base)
          );
        }
        wireAdditionalSlicesIntoModuleFile(modPath, specs);
        return `Updated ${path.relative(repoRoot, modPath)}`;
      },
    ],
  });
}
