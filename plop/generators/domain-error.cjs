const fs = require("fs");
const path = require("path");
const { getRepoRoot, toKebabCase, toConstantCase, getDomainPackageChoices } = require("../lib");
const {
  getEntityNotFoundErrorSpec,
  renderEntityNotFoundErrorFile,
  appendDomainErrorsBarrelExport,
} = require("../lib/entity-not-found-error.cjs");

const repoRoot = getRepoRoot();

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
        choices: getDomainPackageChoices(repoRoot, { excludeCore: false }),
      },
      {
        type: "list",
        name: "errorKind",
        message: "Error kind:",
        choices: [
          {
            name: "Not found — entity id in message & metadata (e.g. UserNotFoundError)",
            value: "not-found",
          },
          {
            name: "Other — custom name & static message (template)",
            value: "custom",
          },
        ],
      },
      {
        type: "input",
        name: "entityPascal",
        message: "Entity name (PascalCase, e.g. User):",
        when: (answers) => answers.errorKind === "not-found",
        validate: (value) => {
          const v = String(value || "").trim();
          if (!v) return "Name cannot be empty";
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(v)) {
            return "Use PascalCase (e.g. User, OrderLine)";
          }
          return true;
        },
        filter: (value) => String(value || "").trim(),
      },
      {
        type: "input",
        name: "errorName",
        message: "Error name (e.g. NotFound, InvalidState):",
        when: (answers) => answers.errorKind === "custom",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: (data) => {
      const { domainPackage, errorKind } = data;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      if (errorKind === "not-found") {
        const entityPascal = data.entityPascal;
        const spec = getEntityNotFoundErrorSpec(entityPascal);
        const errorAbsPath = path.join(
          repoRoot,
          "packages",
          "domain",
          domainPackage,
          "src",
          "errors",
          `${spec.fileKebab}.error.ts`
        );

        if (fs.existsSync(errorAbsPath)) {
          throw new Error(
            `Error file already exists: ${errorAbsPath}. Remove it or pick another entity.`
          );
        }

        actions.push({
          type: "add",
          path: `../packages/domain/${domainPackage}/src/errors/${spec.fileKebab}.error.ts`,
          template: renderEntityNotFoundErrorFile(entityPascal),
        });
      } else {
        const { errorName } = data;
        const kebab = toKebabCase(errorName);

        actions.push({
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/errors/{{kebabCase errorName}}.error.ts",
          templateFile: "templates/domain-error/error.ts.hbs",
        });
      }

      const exportFileKebab =
        errorKind === "not-found"
          ? getEntityNotFoundErrorSpec(data.entityPascal).fileKebab
          : toKebabCase(data.errorName);

      actions.push({
        type: "modify",
        path: "../packages/domain/{{domainPackage}}/src/errors/index.ts",
        transform: (file) => appendDomainErrorsBarrelExport(file, exportFileKebab),
      });

      return actions;
    },
  });
};
