const fs = require("fs");
const path = require("path");
const { getRepoRoot, toKebabCase, toConstantCase } = require("../lib");

const repoRoot = getRepoRoot();

function getDomainPackageChoices() {
  const domainRoot = path.join(repoRoot, "packages", "domain");
  if (!fs.existsSync(domainRoot)) return [];

  return fs
    .readdirSync(domainRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()) // include core as well
    .map((entry) => ({
      name: entry.name,
      value: entry.name,
    }));
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainErrorGenerator(plop) {
  plop.setHelper("constantCase", toConstantCase);

  plop.setGenerator("domain-error", {
    description: "Add a new DomainError subclass to a @domain/* package (including core)",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(),
      },
      {
        type: "input",
        name: "errorName",
        message: "Error name (e.g. NotFound, InvalidState):",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: (data) => {
      const { domainPackage, errorName } = data;
      const kebab = toKebabCase(errorName);

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      // Add error file
      actions.push({
        type: "add",
        path: "../packages/domain/{{domainPackage}}/src/errors/{{kebabCase errorName}}.error.ts",
        templateFile: "templates/domain-error/error.ts.hbs",
      });

      // Update errors barrel
      actions.push({
        type: "modify",
        path: "../packages/domain/{{domainPackage}}/src/errors/index.ts",
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${kebab}.error';`;

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
