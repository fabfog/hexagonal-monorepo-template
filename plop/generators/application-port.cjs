const fs = require("fs");
const path = require("path");
const { getRepoRoot, toKebabCase } = require("../lib");

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

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerApplicationPortGenerator(plop) {
  plop.setGenerator("application-port", {
    description: "Add a new Port interface to an existing @application/* package",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select application package:",
        choices: getApplicationPackageChoices(),
      },
      {
        type: "confirm",
        name: "isInteractionPort",
        message: "Is this an InteractionPort?",
        default: false,
      },
      {
        type: "input",
        name: "portName",
        message:
          "Port base name (e.g. PageRepository, UserNotification). Do not include Port/InteractionPort in the name, it will be added automatically:",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: (data) => {
      const { packageName, portName, isInteractionPort } = data;
      const baseName = String(portName || "")
        .trim()
        .replace(/Port$/i, "")
        .replace(/InteractionPort$/i, "")
        .replace(/Interaction$/i, "");

      const interfaceName = isInteractionPort ? `${baseName}InteractionPort` : `${baseName}Port`;

      const fileBase = toKebabCase(baseName);
      const fileSuffix = isInteractionPort ? ".interaction.port" : ".port";
      const filePath = `../packages/application/${packageName}/src/ports/${fileBase}${fileSuffix}.ts`;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      // Add port file
      actions.push({
        type: "add",
        path: filePath,
        templateFile: "templates/application-port/port.ts.hbs",
        data: {
          interfaceName,
        },
      });

      // Update ports barrel
      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/src/ports/index.ts",
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${fileBase}${fileSuffix}';`;

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
