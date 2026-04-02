/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionPackageGenerator(plop) {
  plop.setGenerator("composition-package", {
    description:
      "Create a new @composition/<name> package: package.json (single entry export), tsconfig.json, src/types.ts, src/infrastructure.ts, src/index.ts (get<PascalCase>Modules(ctx) stub; infrastructureProvider non re-exported).",
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
        path: "../packages/composition/{{kebabCase name}}/src/types.ts",
        templateFile: "templates/composition-package/src/types.ts.hbs",
      },
      {
        type: "add",
        path: "../packages/composition/{{kebabCase name}}/src/infrastructure.ts",
        templateFile: "templates/composition-package/src/infrastructure.ts.hbs",
      },
      {
        type: "add",
        path: "../packages/composition/{{kebabCase name}}/src/index.ts",
        templateFile: "templates/composition-package/src/index.ts.hbs",
      },
    ],
  });
};
