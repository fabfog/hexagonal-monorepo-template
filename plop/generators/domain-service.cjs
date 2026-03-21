const {
  getRepoRoot,
  toKebabCase,
  getDomainPackageChoices,
  getDomainEntityChoices,
} = require("../lib");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainServiceGenerator(plop) {
  plop.setGenerator("domain-service", {
    description:
      "Add a domain service (execute + Input/Output types) to a @domain/* package, importing selected entities",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(repoRoot),
      },
      {
        type: "checkbox",
        name: "selectedEntities",
        message: "Select one or more entities this service will use (space to toggle):",
        choices: (answers) => getDomainEntityChoices(repoRoot, answers.domainPackage),
        validate: (selected) =>
          Array.isArray(selected) && selected.length > 0 ? true : "Select at least one entity",
      },
      {
        type: "input",
        name: "serviceName",
        message:
          "Service base name (WITHOUT the 'Service' suffix). Prefer a specific capability, e.g. UserDiscountEligibility, OrderShippingWindow — avoid vague names like User or UserService:",
        validate: (value) => {
          const trimmed = String(value || "").trim();
          if (!trimmed) return "Name cannot be empty";
          return true;
        },
        filter: (value) =>
          String(value || "")
            .trim()
            .replace(/Service$/i, ""),
      },
    ],
    actions: (data) => {
      const { domainPackage, serviceName } = data;
      const kebab = toKebabCase(serviceName);

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      actions.push({
        type: "add",
        path: `../packages/domain/${domainPackage}/src/services/${kebab}.service.ts`,
        templateFile: "templates/domain-service/service.ts.hbs",
      });

      actions.push({
        type: "modify",
        path: `../packages/domain/${domainPackage}/src/services/index.ts`,
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${kebab}.service';`;

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
