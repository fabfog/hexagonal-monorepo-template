const {
  getRepoRoot,
  toKebabCase,
  toPascalCase,
  getDomainPackageChoices,
  ensureZodDependencyInDomainPackage,
} = require("../lib");
const { appendEnsureEntityNotFoundErrorActions } = require("../lib/entity-not-found-error.cjs");
const { appendDomainValueObjectActions } = require("../lib/domain-value-object.cjs");
const { ensureDomainPackageSlice } = require("../lib/ensure-package-slice.cjs");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainEntityGenerator(plop) {
  plop.setGenerator("domain-entity", {
    description:
      "Add a new Domain Entity to an existing @domain/* package (schema, types, class in one file)",
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
      {
        type: "confirm",
        name: "addNotFoundError",
        default: true,
        message: (answers) => {
          const name = toPascalCase(String(answers.entityName || "").trim());
          return `Also create ${name}NotFoundError associated with ${name}?`;
        },
      },
    ],
    actions: (data) => {
      const { domainPackage, entityName, addNotFoundError } = data;
      const kebab = toKebabCase(entityName);
      const entityPascal = toPascalCase(String(entityName || "").trim());

      const actions = [];

      appendDomainValueObjectActions(actions, {
        repoRoot,
        domainPackage,
        valueObjectName: `${entityPascal}Id`,
        valueObjectKind: "single-value",
        singleValuePrimitive: "string",
      });

      actions.push(() => {
        ensureDomainPackageSlice(repoRoot, domainPackage, "entities");
      });

      actions.push(
        {
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/entities/{{kebabCase entityName}}.entity.ts",
          templateFile: "templates/domain-entity/entity.ts.hbs",
        },
        {
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/entities/{{kebabCase entityName}}.entity.test.ts",
          templateFile: "templates/domain-entity/entity.test.ts.hbs",
        },
        {
          type: "modify",
          path: "../packages/domain/{{domainPackage}}/src/entities/index.ts",
          transform: (file) => {
            const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
            const exportEntity = `export * from './${kebab}.entity';`;

            let next = cleaned;
            if (!next.includes(exportEntity)) {
              next = next.length > 0 ? `${next}\n${exportEntity}` : exportEntity;
            }

            return `${next}\n`;
          },
        },
        () => ensureZodDependencyInDomainPackage(repoRoot, domainPackage)
      );

      if (addNotFoundError) {
        appendEnsureEntityNotFoundErrorActions(actions, {
          repoRoot,
          domainPackage,
          entityPascal,
        });
      }

      return actions;
    },
  });
};
