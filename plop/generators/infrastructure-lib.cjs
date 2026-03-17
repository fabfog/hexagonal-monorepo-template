/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerInfrastructureLibGenerator(plop) {
  plop.setGenerator("infrastructure-lib", {
    description:
      "Create a new infrastructure lib package under packages/infrastructure (e.g. lib-react-store)",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Infrastructure lib name (e.g. http, react-store):",
      },
    ],
    actions: () => {
      /** @type {import('plop').ActionType[]} */
      const actions = [
        {
          type: "add",
          path: "../packages/infrastructure/lib-{{kebabCase name}}/package.json",
          templateFile: "templates/infrastructure-lib/package.json.hbs",
        },
        {
          type: "add",
          path: "../packages/infrastructure/lib-{{kebabCase name}}/tsconfig.json",
          templateFile: "templates/infrastructure-lib/tsconfig.json.hbs",
        },
        {
          type: "add",
          path: "../packages/infrastructure/lib-{{kebabCase name}}/src/index.ts",
          templateFile: "templates/infrastructure-lib/src/index.ts.hbs",
        },
      ];

      return actions;
    },
  });
};
