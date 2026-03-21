const { toKebabCase } = require("../lib");

const REPOSITORY_IN_NAME_MESSAGE =
  'Do not include the word "repository" in the package name. ' +
  'Use the generator prompt "Will this package implement a repository adapter?" instead; ' +
  "when you answer yes, the folder and package name will be prefixed with driven-repository-.";

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerInfrastructureDrivenAdapterGenerator(plop) {
  plop.setGenerator("infrastructure-driven-adapter", {
    description:
      "Create a new driven infrastructure package: driven-<name> or driven-repository-<name> (persistence adapters)",
    prompts: [
      {
        type: "input",
        name: "name",
        message:
          'Adapter capability name (e.g. contentful, stripe, postgres). Omit any driven- or "repository" prefix:',
        validate: (value) => {
          const trimmed = String(value || "").trim();
          if (!trimmed) return "Name cannot be empty";
          if (/repository/i.test(trimmed)) {
            return REPOSITORY_IN_NAME_MESSAGE;
          }
          return true;
        },
        filter: (value) => String(value || "").trim(),
      },
      {
        type: "confirm",
        name: "isRepository",
        default: false,
        message:
          "Will this package implement a repository adapter (a persistence implementation of an application port)?",
      },
    ],
    actions: (data) => {
      const kebab = toKebabCase(data.name);
      const packageFolder = data.isRepository ? `driven-repository-${kebab}` : `driven-${kebab}`;
      data.packageFolder = packageFolder;

      /** @type {import('plop').ActionType[]} */
      const actions = [
        {
          type: "add",
          path: `../packages/infrastructure/${packageFolder}/package.json`,
          templateFile: "templates/infrastructure-driven/package.json.hbs",
        },
        {
          type: "add",
          path: `../packages/infrastructure/${packageFolder}/tsconfig.json`,
          templateFile: "templates/infrastructure-driven/tsconfig.json.hbs",
        },
        {
          type: "add",
          path: `../packages/infrastructure/${packageFolder}/src/index.ts`,
          templateFile: "templates/infrastructure-driven/src/index.ts.hbs",
        },
      ];

      return actions;
    },
  });
};
