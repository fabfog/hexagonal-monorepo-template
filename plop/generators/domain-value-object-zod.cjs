const {
  getRepoRoot,
  toKebabCase,
  getDomainPackageChoices,
  ensureZodDependencyInDomainPackage,
} = require("../lib");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainValueObjectZodGenerator(plop) {
  plop.setGenerator("domain-value-object-zod", {
    description: "Add a new Value Object with Zod schema to an existing @domain/* package",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "valueObjectName",
        message:
          "Value Object base name (e.g. UserId, EmailAddress). Do not include ValueObject in the name, it will be added automatically:",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: (data) => {
      const { domainPackage, valueObjectName } = data;
      const kebab = toKebabCase(valueObjectName);

      const actions = [
        {
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/value-objects/{{kebabCase valueObjectName}}.vo.ts",
          templateFile: "templates/domain-value-object-zod/value-object.ts.hbs",
        },
        {
          type: "modify",
          path: "../packages/domain/{{domainPackage}}/src/value-objects/index.ts",
          transform: (file) => {
            const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
            const exportLine = `export * from './${kebab}.vo';`;

            if (cleaned.includes(exportLine)) {
              return `${cleaned}\n`;
            }

            const base = cleaned.length > 0 ? `${cleaned}\n` : "";
            return `${base}${exportLine}\n`;
          },
        },
        () => ensureZodDependencyInDomainPackage(repoRoot, domainPackage),
      ];

      return actions;
    },
  });
};
