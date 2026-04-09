import type { NodePlopAPI } from "node-plop";
import { getRepoRoot, toKebabCase, getApplicationPackageChoices } from "../lib/index.ts";
import { ensureApplicationPackageSlice } from "../lib/ensure-package-slice.ts";
import type { Answers } from "inquirer";
const repoRoot = getRepoRoot();
export default function registerApplicationFlowGenerator(plop: NodePlopAPI) {
  plop.setGenerator("application-flow", {
    description: "Add a new Flow class + interaction port to an existing @application/* package",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select application package:",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "flowName",
        message:
          "Flow base name (e.g. UpdateUser, PublishPage). Do not include Flow in the name, it will be added automatically:",
        validate: (value: unknown) =>
          String(value || "").trim().length > 0 || "Name cannot be empty",
        filter: (value: unknown) => String(value || "").trim(),
      },
    ],
    actions: (data?: Answers) => {
      if (!data) return [];
      const { packageName } = data;
      const flowName = String(data.flowName || "").trim();
      const flowKebab = toKebabCase(flowName);
      const interactionName = `${flowName}InteractionPort`;
      /** @type {import('node-plop').ActionType[]} */
      const actions = [];
      actions.push(() => {
        ensureApplicationPackageSlice(repoRoot, packageName, "ports");
        ensureApplicationPackageSlice(repoRoot, packageName, "flows");
        return "";
      });
      // Add interaction port file (interface)
      actions.push({
        type: "add",
        path: "../packages/application/{{packageName}}/src/ports/{{kebabCase flowName}}.interaction.port.ts",
        templateFile: "templates/application-port/port.ts.hbs",
        skipIfExists: true,
        data: {
          interfaceName: interactionName,
        },
      });
      // Update ports barrel
      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/src/ports/index.ts",
        transform: (file: string) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${flowKebab}.interaction.port';`;
          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }
          const base = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${base}${exportLine}\n`;
        },
      });
      // Add flow file
      actions.push({
        type: "add",
        path: "../packages/application/{{packageName}}/src/flows/{{kebabCase flowName}}.flow.ts",
        templateFile: "templates/application-flow/flow.ts.hbs",
      });
      // Add flow test file
      actions.push({
        type: "add",
        path: "../packages/application/{{packageName}}/src/flows/{{kebabCase flowName}}.flow.test.ts",
        templateFile: "templates/application-flow/flow.test.ts.hbs",
      });
      // Update flows barrel
      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/src/flows/index.ts",
        transform: (file: string) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${flowKebab}.flow';`;
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
