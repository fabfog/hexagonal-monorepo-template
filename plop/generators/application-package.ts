import type { NodePlopAPI } from "node-plop";
export function getApplicationPackageBaseActions(nameExpression: string) {
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
export default function registerApplicationPackageGenerator(plop: NodePlopAPI) {
  plop.setGenerator("application-package", {
    description:
      "Create a new application package (@application/<name>); ports, use-cases, etc. are added when you first generate into each slice",
    prompts: [
      {
        type: "input",
        name: "packageName",
        message: "Application package name (e.g. editor, billing):",
        validate: (value: unknown) =>
          String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: () => getApplicationPackageBaseActions("{{kebabCase packageName}}"),
  });
}
