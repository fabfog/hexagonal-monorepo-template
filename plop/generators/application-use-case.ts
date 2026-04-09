import type { NodePlopAPI } from "node-plop";
import { getRepoRoot, toKebabCase, getApplicationPackageChoices } from "../lib/index.ts";
import { ensureApplicationPackageSlice } from "../lib/ensure-package-slice.ts";
import type { Answers } from "inquirer";
const repoRoot = getRepoRoot();
export default function registerApplicationUseCaseGenerator(plop: NodePlopAPI) {
  plop.setGenerator("application-use-case", {
    description: "Add a new Use Case class to an existing @application/* package",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select application package:",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "useCaseName",
        message:
          "Use case base name (e.g. CreatePage, UpdateUserProfile). Do not include UseCase in the name, it will be added automatically:",
        validate: (value: unknown) =>
          String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: (data?: Answers) => {
      if (!data) return [];
      const { packageName, useCaseName } = data;
      const kebab = toKebabCase(useCaseName);
      /** @type {import('node-plop').ActionType[]} */
      const actions = [];
      actions.push(() => {
        ensureApplicationPackageSlice(repoRoot, packageName, "use-cases");
        return "";
      });
      // Add use-case file
      actions.push({
        type: "add",
        path: "../packages/application/{{packageName}}/src/use-cases/{{kebabCase useCaseName}}.use-case.ts",
        templateFile: "templates/application-use-case/use-case.ts.hbs",
      });
      // Add use-case test file
      actions.push({
        type: "add",
        path: "../packages/application/{{packageName}}/src/use-cases/{{kebabCase useCaseName}}.use-case.test.ts",
        templateFile: "templates/application-use-case/use-case.test.ts.hbs",
      });
      // Update use-cases barrel
      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/src/use-cases/index.ts",
        transform: (file: string) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${kebab}.use-case';`;
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
