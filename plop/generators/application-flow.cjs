const fs = require("fs");
const path = require("path");

function toKebabCase(value) {
  return String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

const repoRoot = path.join(__dirname, "..", "..");

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

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerApplicationFlowGenerator(plop) {
  plop.setGenerator("application-flow", {
    description: "Add a new Flow class + interaction port to an existing @application/* package",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select application package:",
        choices: getApplicationPackageChoices(),
      },
      {
        type: "input",
        name: "flowName",
        message: "Flow name (e.g. UpdateUser, PublishPage):",
      },
    ],
    actions: (data) => {
      const { flowName } = data;
      const flowKebab = toKebabCase(flowName);
      const interactionKebab = toKebabCase(`${flowName}Interaction`);

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      // Add interaction port file (interface)
      actions.push({
        type: "add",
        path: "../packages/application/{{packageName}}/src/ports/{{kebabCase flowName}}-interaction.port.ts",
        templateFile: "templates/application-port/port.ts.hbs",
        data: {
          portName: `${flowName}Interaction`,
        },
      });

      // Update ports barrel
      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/src/ports/index.ts",
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${interactionKebab}.port';`;

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

      // Update flows barrel
      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/src/flows/index.ts",
        transform: (file) => {
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
};
