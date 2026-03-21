function getApplicationPackageBaseActions(nameExpression) {
  return [
    {
      type: "add",
      path: `../packages/application/${nameExpression}/package.json`,
      templateFile: "templates/application-package/package.json.hbs",
    },
    {
      type: "add",
      path: `../packages/application/${nameExpression}/tsconfig.json`,
      templateFile: "templates/application-package/tsconfig.json.hbs",
    },
    {
      type: "add",
      path: `../packages/application/${nameExpression}/src/ports/index.ts`,
      templateFile: "templates/application-package/src/ports/index.ts.hbs",
    },
    {
      type: "add",
      path: `../packages/application/${nameExpression}/src/use-cases/index.ts`,
      templateFile: "templates/application-package/src/use-cases/index.ts.hbs",
    },
    {
      type: "add",
      path: `../packages/application/${nameExpression}/src/flows/index.ts`,
      templateFile: "templates/application-package/src/flows/index.ts.hbs",
    },
    {
      type: "add",
      path: `../packages/application/${nameExpression}/src/dtos/index.ts`,
      templateFile: "templates/application-package/src/dtos/index.ts.hbs",
    },
    {
      type: "add",
      path: `../packages/application/${nameExpression}/src/mappers/index.ts`,
      templateFile: "templates/application-package/src/mappers/index.ts.hbs",
    },
  ];
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerApplicationPackageGenerator(plop) {
  plop.setGenerator("application-package", {
    description:
      "Create a new application package (@application/<name> with ports/flows/use-cases/dtos/mappers)",
    prompts: [
      {
        type: "input",
        name: "packageName",
        message: "Application package name (e.g. editor, billing):",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: () => getApplicationPackageBaseActions("{{kebabCase packageName}}"),
  });
};

module.exports.getApplicationPackageBaseActions = getApplicationPackageBaseActions;
