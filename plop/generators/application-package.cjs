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
      path: `../packages/application/${nameExpression}/src/.gitkeep`,
      template: "",
      skipIfExists: true,
    },
  ];
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerApplicationPackageGenerator(plop) {
  plop.setGenerator("application-package", {
    description:
      "Create a new application package (@application/<name>); ports, use-cases, etc. are added when you first generate into each slice",
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
