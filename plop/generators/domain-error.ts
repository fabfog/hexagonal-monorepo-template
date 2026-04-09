import type { NodePlopAPI } from "node-plop";
import fs from "node:fs";
import path from "node:path";
import { getRepoRoot, toKebabCase, toConstantCase, getDomainPackageChoices } from "../lib/index.ts";
import { ensureDomainPackageSlice } from "../lib/ensure-package-slice.ts";
import type { Answers } from "inquirer";
import {
  getEntityNotFoundErrorSpec,
  renderEntityNotFoundErrorFile,
  appendDomainErrorsBarrelExport,
} from "../lib/entity-not-found-error.ts";
const repoRoot = getRepoRoot();
export default function registerDomainErrorGenerator(plop: NodePlopAPI) {
  plop.setHelper("constantCase", toConstantCase);
  plop.setGenerator("domain-error", {
    description: "Add a new DomainError subclass to a @domain/* package (including core)",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(repoRoot, { excludeCore: false }),
      },
      {
        type: "list",
        name: "errorKind",
        message: "Error kind:",
        choices: [
          {
            name: "Not found — entity id in message & metadata (e.g. UserNotFoundError)",
            value: "not-found",
          },
          {
            name: "Other — custom name & static message (template)",
            value: "custom",
          },
        ],
      },
      {
        type: "input",
        name: "entityPascal",
        message: "Entity name (PascalCase, e.g. User):",
        when: (answers: Answers) => answers.errorKind === "not-found",
        validate: (value: unknown) => {
          const v = String(value || "").trim();
          if (!v) return "Name cannot be empty";
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(v)) {
            return "Use PascalCase (e.g. User, OrderLine)";
          }
          return true;
        },
        filter: (value: unknown) => String(value || "").trim(),
      },
      {
        type: "input",
        name: "errorName",
        message: "Error name (e.g. NotFound, InvalidState):",
        when: (answers: Answers) => answers.errorKind === "custom",
        validate: (value: unknown) =>
          String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: (data?: Answers) => {
      if (!data) return [];
      const { domainPackage, errorKind } = data;
      /** @type {import('node-plop').ActionType[]} */
      const actions = [];
      actions.push(() => {
        ensureDomainPackageSlice(repoRoot, domainPackage, "errors");
        return "";
      });
      if (errorKind === "not-found") {
        const entityPascal = data.entityPascal;
        const spec = getEntityNotFoundErrorSpec(entityPascal);
        const errorAbsPath = path.join(
          repoRoot,
          "packages",
          "domain",
          domainPackage,
          "src",
          "errors",
          `${spec.fileKebab}.error.ts`
        );
        if (fs.existsSync(errorAbsPath)) {
          throw new Error(
            `Error file already exists: ${errorAbsPath}. Remove it or pick another entity.`
          );
        }
        actions.push({
          type: "add",
          path: `../packages/domain/${domainPackage}/src/errors/${spec.fileKebab}.error.ts`,
          template: renderEntityNotFoundErrorFile(entityPascal),
        });
      } else {
        actions.push({
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/errors/{{kebabCase errorName}}.error.ts",
          templateFile: "templates/domain-error/error.ts.hbs",
        });
      }
      const exportFileKebab =
        errorKind === "not-found"
          ? getEntityNotFoundErrorSpec(data.entityPascal).fileKebab
          : toKebabCase(data.errorName);
      actions.push({
        type: "modify",
        path: "../packages/domain/{{domainPackage}}/src/errors/index.ts",
        transform: (file: string) => appendDomainErrorsBarrelExport(file, exportFileKebab),
      });
      return actions;
    },
  });
}
