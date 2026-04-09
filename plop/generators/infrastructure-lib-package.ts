import type { NodePlopAPI } from "node-plop";
export default function registerInfrastructureLibPackageGenerator(plop: NodePlopAPI) {
  plop.setGenerator("infrastructure-lib-package", {
    description:
      "Create a new infrastructure lib package under packages/infrastructure (e.g. lib-react-store)",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Infrastructure lib name (e.g. http):",
        validate: (value: unknown) =>
          String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: () => {
      /** @type {import('node-plop').ActionType[]} */
      const actions = [
        {
          type: "add",
          path: "../packages/infrastructure/lib-{{kebabCase name}}/package.json",
          templateFile: "templates/infrastructure-lib-package/package.json.hbs",
        },
        {
          type: "add",
          path: "../packages/infrastructure/lib-{{kebabCase name}}/tsconfig.json",
          templateFile: "templates/infrastructure-lib-package/tsconfig.json.hbs",
        },
        {
          type: "add",
          path: "../packages/infrastructure/lib-{{kebabCase name}}/src/index.ts",
          templateFile: "templates/infrastructure-lib-package/src/index.ts.hbs",
        },
      ];
      return actions;
    },
  });
}
