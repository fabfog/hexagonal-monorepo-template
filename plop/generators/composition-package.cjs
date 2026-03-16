/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionPackageGenerator(plop) {
  plop.setGenerator("composition-package", {
    description:
      "Create a new composition package (@composition/<name>) with a single entry point src/index.ts",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Composition package name (e.g. web, api, shell):",
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
        path: "../packages/composition/{{kebabCase name}}/src/index.ts",
        templateFile: "templates/composition-package/src/index.ts.hbs",
      },
    ],
  });
};
