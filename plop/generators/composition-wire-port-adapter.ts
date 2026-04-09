import type { NodePlopAPI } from "node-plop";
import fs from "node:fs";
import path from "node:path";
import {
  scanPortImplementations,
  type PortImplementationChoice,
} from "../lib/scan-infrastructure-port-implementations.ts";
import {
  getRepoRoot,
  getCompositionPackageChoices,
  getInfrastructurePackagesWithPortImplementationsChoices,
  packagePath,
} from "../lib/index.ts";
import type { Answers } from "inquirer";
import {
  wirePortAdapterIntoCompositionInfrastructure,
  ensureCompositionDependsOnInfrastructure,
  ensureCompositionDependsOnApplicationForPortImport,
} from "../lib/wire-port-adapter-in-composition-infra.ts";
const repoRoot = getRepoRoot();
/**
 * @param {string} encoded
 * @returns {{ className: string, relativePath: string, portInterfaceName: string }}
 */
function parseImplementationChoice(encoded: unknown) {
  const parts = String(encoded).split("\t");
  if (parts.length !== 3) {
    throw new Error(`Invalid implementation choice (expected 3 tab-separated parts): ${encoded}`);
  }
  const [className, relativePath, portInterfaceName] = parts;
  if (!className || !relativePath || !portInterfaceName) {
    throw new Error(`Invalid implementation choice (missing fields): ${encoded}`);
  }
  return { className, relativePath, portInterfaceName };
}
export default function registerCompositionWirePortAdapterGenerator(plop: NodePlopAPI) {
  plop.setGenerator("composition-wire-port-adapter", {
    description:
      "Wire an infrastructure adapter (class implementing a *Port) into composition src/infrastructure.ts — app- or request-scoped, with Infra object property name",
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
        type: "list",
        name: "infrastructurePackage",
        message: "Infrastructure package (with at least one port adapter class):",
        choices: () => {
          const c = getInfrastructurePackagesWithPortImplementationsChoices(repoRoot);
          if (!c.length) {
            throw new Error(
              "No infrastructure packages export a class implementing *Port / *InteractionPort."
            );
          }
          return c;
        },
      },
      {
        type: "list",
        name: "implementationChoice",
        message: "Adapter class (implements which port):",
        choices: (answers: Answers) => {
          const list = scanPortImplementations(repoRoot, answers.infrastructurePackage);
          return list.map((x: PortImplementationChoice) => ({
            name: `${x.className} → ${x.portInterfaceName} (${x.relativePath})`,
            value: `${x.className}\t${x.relativePath}\t${x.portInterfaceName}`,
          }));
        },
      },
      {
        type: "input",
        name: "propName",
        message:
          "Property name on the object returned from getForContext (camelCase, e.g. ticketRepository):",
        validate: (value: unknown) => {
          const v = String(value || "").trim();
          if (!v) return "Property name is required";
          if (!/^[a-z][a-zA-Z0-9]*$/.test(v)) return "Use a valid camelCase identifier";
          return true;
        },
      },
      {
        type: "list",
        name: "scope",
        message: "Lifetime / wiring style:",
        choices: [
          {
            name: "App-scoped — private readonly field; same instance for all requests (FIXME stub if constructor needs args)",
            value: "app",
          },
          {
            name: "Request-scoped — private get…(ctx) method; new (or context-bound) instance per getForContext call",
            value: "request",
          },
        ],
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
            `Missing ${path.relative(repoRoot, infraPath)}. Create the composition package (composition-package) or add infrastructure.ts.`
          );
        }
        const { className, relativePath, portInterfaceName } = parseImplementationChoice(
          data.implementationChoice
        );
        const implementations = scanPortImplementations(repoRoot, data.infrastructurePackage);
        const picked = implementations.find(
          (x: PortImplementationChoice) =>
            x.className === className &&
            x.relativePath === relativePath &&
            x.portInterfaceName === portInterfaceName
        );
        if (!picked) {
          throw new Error(
            "Selected implementation no longer matches scan results; re-run the generator."
          );
        }
        const propName = String(data.propName).trim();
        const scope = data.scope === "app" ? "app" : "request";
        const pkgJsonPath = packagePath(
          repoRoot,
          "composition",
          data.compositionPackage,
          "package.json"
        );
        ensureCompositionDependsOnInfrastructure(pkgJsonPath, picked.npmPackageName);
        ensureCompositionDependsOnApplicationForPortImport(
          pkgJsonPath,
          picked.absolutePath,
          portInterfaceName
        );
        const next = wirePortAdapterIntoCompositionInfrastructure(infraPath, {
          propName,
          scope,
          adapterClassName: picked.className,
          adapterNpmPackageName: picked.npmPackageName,
          portInterfaceName: picked.portInterfaceName,
          adapterFileAbsPath: picked.absolutePath,
          requiredConstructorParams: picked.requiredConstructorParams,
        });
        fs.writeFileSync(infraPath, next, "utf8");
        return `Wired ${picked.className} → ${propName} (${scope}) in ${path.relative(repoRoot, infraPath)}`;
      },
    ],
  });
}
