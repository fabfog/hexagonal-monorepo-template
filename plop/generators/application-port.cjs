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
        type: "input",
        name: "portName",
        message: "Port name (e.g. PageRepository, UserNotification):",
      },
    ],
    actions: (data) => {
      const { portName } = data;
      const kebab = toKebabCase(portName);

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      // Add port file
      actions.push({
        type: "add",
        path: "../packages/application/{{packageName}}/src/ports/{{kebabCase portName}}.port.ts",
        templateFile: "templates/application-port/port.ts.hbs",
      });

      // Update ports barrel
      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/src/ports/index.ts",
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${kebab}.port';`;

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
