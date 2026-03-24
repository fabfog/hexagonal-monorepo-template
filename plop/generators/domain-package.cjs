/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainPackageGenerator(plop) {
  plop.setGenerator("domain-package", {
    description:
      "Create a new domain package (@domain/<name>); entities, errors, etc. are added when you first generate into each slice",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Domain package name (e.g. user, document):",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: () => [
      {
        type: "add",
        path: "../packages/domain/{{kebabCase name}}/package.json",
        templateFile: "templates/domain-package/package.json.hbs",
      },
      {
        type: "add",
        path: "../packages/domain/{{kebabCase name}}/tsconfig.json",
        templateFile: "templates/domain-package/tsconfig.json.hbs",
      },
      {
        type: "add",
        path: "../packages/domain/{{kebabCase name}}/src/.gitkeep",
        template: "",
        skipIfExists: true,
      },
    ],
  });
};
