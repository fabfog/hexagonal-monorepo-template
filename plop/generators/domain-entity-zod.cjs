const {
  getRepoRoot,
  toKebabCase,
  getDomainPackageChoices,
  ensureZodDependencyInDomainPackage,
} = require("../lib");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainEntityZodGenerator(plop) {
  plop.setGenerator("domain-entity-zod", {
    description: "Add a new Domain Entity with Zod schema to an existing @domain/* package",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "entityName",
        message:
          "Entity base name (e.g. Document, UserProfile). Do not include Entity in the name, it will be added automatically:",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: (data) => {
      const { domainPackage, entityName } = data;
      const kebab = toKebabCase(entityName);

      const actions = [
        {
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/entities/{{kebabCase entityName}}.entity.ts",
          templateFile: "templates/domain-entity-zod/entity.ts.hbs",
        },
        {
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/entities/{{kebabCase entityName}}.entity.test.ts",
          templateFile: "templates/domain-entity-zod/entity.test.ts.hbs",
        },
        {
          type: "modify",
          path: "../packages/domain/{{domainPackage}}/src/entities/index.ts",
          transform: (file) => {
            const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
            const exportLine = `export * from './${kebab}.entity';`;

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
