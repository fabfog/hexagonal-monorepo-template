/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionPackageGenerator(plop) {
  plop.setGenerator("composition-package", {
    description:
      "Create a new composition package shell (@composition/<name>). Runtime folders (isomorphic / server / client) and package.json exports are added when you run composition-feature-dependencies (per selected runtimes).",
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
        path: "../packages/composition/{{kebabCase name}}/src/.gitkeep",
        template: "",
      },
    ],
  });
};
