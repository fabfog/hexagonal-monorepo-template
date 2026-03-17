const fs = require("fs");
const path = require("path");

function toKebabCase(value) {
  return String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function getApplicationPackageChoices() {
  const repoRoot = path.join(__dirname, "..", "..");
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
module.exports = function registerApplicationUseCaseGenerator(plop) {
  plop.setGenerator("application-use-case", {
    description: "Add a new Use Case class to an existing @application/* package",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select application package:",
        choices: getApplicationPackageChoices(),
      },
      {
        type: "input",
        name: "useCaseName",
        message: "Use case name (e.g. CreatePage, UpdateUserProfile):",
      },
    ],
    actions: (data) => {
      const { useCaseName } = data;
      const kebab = toKebabCase(useCaseName);

      /** @type {import('plop').ActionType[]} */
      const actions = [];

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
        transform: (file) => {
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
};
