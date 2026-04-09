import type { ActionType, NodePlopAPI } from "node-plop";
import { appendEnsureEntityNotFoundErrorActions } from "../lib/entity-not-found-error.ts";
import { appendDomainValueObjectActions } from "../lib/domain-value-object.ts";
import { ensureDomainPackageSlice } from "../lib/ensure-package-slice.ts";
import type { Answers } from "inquirer";
import {
  getRepoRoot,
  toKebabCase,
  toPascalCase,
  getDomainPackageChoices,
  ensureZodDependencyInDomainPackage,
} from "../lib/index.ts";
const repoRoot = getRepoRoot();
export default function registerDomainEntityGenerator(plop: NodePlopAPI) {
  plop.setGenerator("domain-entity", {
    description:
      "Add a new Domain Entity to an existing @domain/* package (schema, types, class in one file)",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "entityName",
        message:
          "Entity base name (e.g. Document, UserProfile). Do not include Entity in the name, it will be added automatically:",
        validate: (value: unknown) =>
          String(value || "").trim().length > 0 || "Name cannot be empty",
      },
      {
        type: "confirm",
        name: "addNotFoundError",
        default: true,
        message: (answers: Answers) => {
          const name = toPascalCase(String(answers.entityName || "").trim());
          return `Also create ${name}NotFoundError associated with ${name}?`;
        },
      },
    ],
    actions: (data?: Answers) => {
      if (!data) return [];
      const { domainPackage, entityName, addNotFoundError } = data;
      const kebab = toKebabCase(entityName);
      const entityPascal = toPascalCase(String(entityName || "").trim());
      const actions: ActionType[] = [];
      appendDomainValueObjectActions(actions, {
        repoRoot,
        domainPackage,
        valueObjectName: `${entityPascal}Id`,
        valueObjectKind: "single-value",
        singleValuePrimitive: "string",
      });
      actions.push(() => {
        ensureDomainPackageSlice(repoRoot, domainPackage, "entities");
        return "";
      });
      actions.push(
        {
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/entities/{{kebabCase entityName}}.entity.ts",
          templateFile: "templates/domain-entity/entity.ts.hbs",
        },
        {
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/entities/{{kebabCase entityName}}.entity.test.ts",
          templateFile: "templates/domain-entity/entity.test.ts.hbs",
        },
        {
          type: "modify",
          path: "../packages/domain/{{domainPackage}}/src/entities/index.ts",
          transform: (file: string) => {
            const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
            const exportEntity = `export * from './${kebab}.entity';`;
            let next = cleaned;
            if (!next.includes(exportEntity)) {
              next = next.length > 0 ? `${next}\n${exportEntity}` : exportEntity;
            }
            return `${next}\n`;
          },
        },
        () => {
          ensureZodDependencyInDomainPackage(repoRoot, domainPackage);
          return "";
        }
      );
      if (addNotFoundError) {
        appendEnsureEntityNotFoundErrorActions(actions, {
          repoRoot,
          domainPackage,
          entityPascal,
        });
      }
      return actions;
    },
  });
}
