import type { NodePlopAPI } from "node-plop";
export default function registerUiPackageGenerator(plop: NodePlopAPI) {
  plop.setGenerator("ui-package", {
    description:
      "Create a new UI package under packages/ui/<name> (scope @ui/<name>, e.g. react → packages/ui/react)",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "UI package name (kebab-case, e.g. react, editor-shell):",
        validate: (value: unknown) =>
          String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: () => [
      {
        type: "add",
        path: "../packages/ui/{{kebabCase name}}/package.json",
        templateFile: "templates/ui-package/package.json.hbs",
      },
      {
        type: "add",
        path: "../packages/ui/{{kebabCase name}}/tsconfig.json",
        templateFile: "templates/ui-package/tsconfig.json.hbs",
      },
      {
        type: "add",
        path: "../packages/ui/{{kebabCase name}}/src/index.ts",
        templateFile: "templates/ui-package/src/index.ts.hbs",
      },
    ],
  });
}
