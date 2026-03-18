/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerPresentationPackageGenerator(plop) {
  plop.setGenerator("presentation-package", {
    description: "Create a new presentation package under packages/presentation with ui-* prefix",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "UI package name (e.g. editor, document-view):",
      },
    ],
    actions: () => [
      {
        type: "add",
        path: "../packages/presentation/ui-{{kebabCase name}}/package.json",
        templateFile: "templates/presentation-package/package.json.hbs",
      },
      {
        type: "add",
        path: "../packages/presentation/ui-{{kebabCase name}}/tsconfig.json",
        templateFile: "templates/presentation-package/tsconfig.json.hbs",
      },
      {
        type: "add",
        path: "../packages/presentation/ui-{{kebabCase name}}/src/index.ts",
        templateFile: "templates/presentation-package/src/index.ts.hbs",
      },
    ],
  });
};
