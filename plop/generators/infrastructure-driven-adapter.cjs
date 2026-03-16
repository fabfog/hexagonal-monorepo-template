/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerInfrastructureDrivenAdapterGenerator(plop) {
  plop.setGenerator("infrastructure-driven-adapter", {
    description:
      "Create a new driven adapter package under packages/infrastructure (e.g. driven-contentful)",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Driven adapter name (e.g. contentful, stripe):",
      },
    ],
    actions: () => {
      /** @type {import('plop').ActionType[]} */
      const actions = [
        {
          type: "add",
          path: "../packages/infrastructure/driven-{{kebabCase name}}/package.json",
          templateFile: "templates/infrastructure-driven/package.json.hbs",
        },
        {
          type: "add",
          path: "../packages/infrastructure/driven-{{kebabCase name}}/tsconfig.json",
          templateFile: "templates/infrastructure-driven/tsconfig.json.hbs",
        },
        {
          type: "add",
          path: "../packages/infrastructure/driven-{{kebabCase name}}/src/index.ts",
          templateFile: "templates/infrastructure-driven/src/index.ts.hbs",
        },
      ];

      return actions;
    },
  });
};
