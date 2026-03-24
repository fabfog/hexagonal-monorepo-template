/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionPackageGenerator(plop) {
  plop.setGenerator("composition-package", {
    description:
      "Create a new composition package (@composition/<name>) with isomorphic, server, and client entry points",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Composition package name (e.g. web, api, shell):",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: () => [
      {
        type: "add",
        path: "../packages/composition/{{kebabCase name}}/package.json",
        templateFile: "templates/composition-package/package.json.hbs",
      },
      {
        type: "add",
        path: "../packages/composition/{{kebabCase name}}/tsconfig.json",
        templateFile: "templates/composition-package/tsconfig.json.hbs",
      },
      {
        type: "add",
        path: "../packages/composition/{{kebabCase name}}/src/isomorphic/infrastructure.ts",
        templateFile: "templates/composition-package/infrastructure.ts.hbs",
      },
      {
        type: "add",
        path: "../packages/composition/{{kebabCase name}}/src/isomorphic/index.ts",
        templateFile: "templates/composition-package/src/index.ts.hbs",
      },
      {
        type: "add",
        path: "../packages/composition/{{kebabCase name}}/src/server/infrastructure.ts",
        templateFile: "templates/composition-package/infrastructure.ts.hbs",
      },
      {
        type: "add",
        path: "../packages/composition/{{kebabCase name}}/src/server/index.ts",
        templateFile: "templates/composition-package/src/server/index.ts.hbs",
      },
      {
        type: "add",
        path: "../packages/composition/{{kebabCase name}}/src/client/infrastructure.ts",
        templateFile: "templates/composition-package/infrastructure.ts.hbs",
      },
      {
        type: "add",
        path: "../packages/composition/{{kebabCase name}}/src/client/index.ts",
        templateFile: "templates/composition-package/src/client/index.ts.hbs",
      },
    ],
  });
};
