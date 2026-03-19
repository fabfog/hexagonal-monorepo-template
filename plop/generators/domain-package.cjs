/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainPackageGenerator(plop) {
  plop.setGenerator("domain-package", {
    description: "Create a new domain package (@domain/<name>)",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Domain package name (e.g. core, user, document):",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: () => {
      const actions = [
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
          path: "../packages/domain/{{kebabCase name}}/src/index.ts",
          templateFile: "templates/domain-package/src/index.ts.hbs",
        },
        {
          type: "add",
          path: "../packages/domain/{{kebabCase name}}/src/entities/index.ts",
          templateFile: "templates/domain-package/src/entities/index.ts.hbs",
        },
        {
          type: "add",
          path: "../packages/domain/{{kebabCase name}}/src/value-objects/index.ts",
          templateFile: "templates/domain-package/src/value-objects/index.ts.hbs",
        },
        {
          type: "add",
          path: "../packages/domain/{{kebabCase name}}/src/errors/index.ts",
          templateFile: "templates/domain-package/src/errors/index.ts.hbs",
        },
        {
          type: "add",
          path: "../packages/domain/{{kebabCase name}}/src/services/index.ts",
          templateFile: "templates/domain-package/src/services/index.ts.hbs",
        },
      ];
      return actions;
    },
  });
};
