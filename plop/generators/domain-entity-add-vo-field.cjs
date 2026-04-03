const fs = require("fs");
const path = require("path");
const {
  getRepoRoot,
  toKebabCase,
  toPascalCase,
  getDomainPackageChoices,
  getDomainEntityChoices,
  ensureZodDependencyInDomainPackage,
} = require("../lib");
const {
  getVoFieldChoices,
  appendVoFieldToEntitySource,
  ensureDomainCoreDependency,
} = require("../lib/domain-entity-vo-fields.cjs");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainEntityAddVoFieldGenerator(plop) {
  plop.setGenerator("domain-entity-add-vo-field", {
    description:
      "Add one Zod + VO-backed property to an existing domain entity (run again for more fields). VOs from @domain/core or the entity's package.",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "entityName",
        message: "Select entity:",
        choices: (answers) => getDomainEntityChoices(repoRoot, answers.domainPackage),
      },
      {
        type: "input",
        name: "propName",
        message: "Property name (camelCase, e.g. email, homePage):",
        validate: (value) =>
          /^[a-z][a-zA-Z0-9]*$/.test(String(value || "").trim()) ||
          "Use camelCase starting with a lowercase letter.",
        filter: (v) => String(v || "").trim(),
      },
      {
        type: "list",
        name: "voSelection",
        message: "Select value object type:",
        choices: (answers) => {
          const list = getVoFieldChoices(repoRoot, answers.domainPackage);
          if (list.length === 0) {
            throw new Error(
              `No value objects found in @domain/core or @domain/${answers.domainPackage}. Create VOs first.`
            );
          }
          return list;
        },
      },
    ],
    actions: (data) => {
      const { domainPackage, entityName, propName, voSelection } = data;
      const entityPascal = toPascalCase(String(entityName || "").trim());
      const kebab = toKebabCase(entityName);
      const entityPath = path.join(
        repoRoot,
        "packages",
        "domain",
        domainPackage,
        "src",
        "entities",
        `${kebab}.entity.ts`
      );

      if (!fs.existsSync(entityPath)) {
        throw new Error(`Entity file not found: ${entityPath}`);
      }

      const field = {
        prop: propName,
        voClass: voSelection.voClass,
        source: voSelection.source,
      };

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      if (field.source === "core") {
        actions.push(() => {
          ensureDomainCoreDependency(repoRoot, domainPackage);
        });
      }

      actions.push({
        type: "modify",
        path: `../packages/domain/${domainPackage}/src/entities/${kebab}.entity.ts`,
        transform: (file) => {
          try {
            return appendVoFieldToEntitySource(file, entityPascal, field);
          } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            throw new Error(`Could not patch entity: ${err.message}`);
          }
        },
      });

      actions.push(() => ensureZodDependencyInDomainPackage(repoRoot, domainPackage));

      return actions;
    },
  });
};
