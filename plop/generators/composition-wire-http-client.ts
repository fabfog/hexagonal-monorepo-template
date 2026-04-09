import type { NodePlopAPI } from "node-plop";
import fs from "node:fs";
import path from "node:path";
import { getRepoRoot, getCompositionPackageChoices, packagePath } from "../lib/index.ts";
import type { Answers } from "inquirer";
import {
  wireHttpClientIntoCompositionInfrastructure,
  ensureCompositionDependsOnHttpLib,
} from "../lib/wire-http-client-in-composition-infra.ts";
const repoRoot = getRepoRoot();
export default function registerCompositionWireHttpClientGenerator(plop: NodePlopAPI) {
  plop.setGenerator("composition-wire-http-client", {
    description:
      "Wire a request-scoped HttpClient into composition src/infrastructure.ts using @infrastructure/lib-http",
    prompts: [
      {
        type: "list",
        name: "compositionPackage",
        message: "Composition package:",
        choices: () => {
          const c = getCompositionPackageChoices(repoRoot);
          if (!c.length) {
            throw new Error(
              'No packages under packages/composition. Run "composition-package" first.'
            );
          }
          return c;
        },
      },
      {
        type: "input",
        name: "propName",
        message:
          "Property name on the object returned from getForContext (camelCase, e.g. httpClient):",
        default: "httpClient",
        validate: (value: unknown) => {
          const v = String(value || "").trim();
          if (!v) return "Property name is required";
          if (!/^[a-z][a-zA-Z0-9]*$/.test(v)) return "Use a valid camelCase identifier";
          return true;
        },
      },
    ],
    actions: [
      (data?: Answers) => {
        if (!data) return "";
        const infraPath = packagePath(
          repoRoot,
          "composition",
          data.compositionPackage,
          "src",
          "infrastructure.ts"
        );
        if (!fs.existsSync(infraPath)) {
          throw new Error(
            `Missing ${path.relative(repoRoot, infraPath)}. Create the composition package first.`
          );
        }
        const pkgJsonPath = packagePath(
          repoRoot,
          "composition",
          data.compositionPackage,
          "package.json"
        );
        ensureCompositionDependsOnHttpLib(pkgJsonPath);
        const next = wireHttpClientIntoCompositionInfrastructure(infraPath, {
          propName: String(data.propName).trim(),
        });
        fs.writeFileSync(infraPath, next, "utf8");
        return `Wired request-scoped http client in ${path.relative(repoRoot, infraPath)}`;
      },
    ],
  });
}
