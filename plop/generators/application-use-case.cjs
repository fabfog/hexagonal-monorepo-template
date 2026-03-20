const { getRepoRoot, toKebabCase, getApplicationPackageChoices } = require("../lib");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerApplicationUseCaseGenerator(plop) {
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
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
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
