const fs = require("fs");
const path = require("path");
const {
  getRepoRoot,
  toKebabCase,
  toPascalCase,
  parseInterfaceMethods,
  getApplicationPackageChoices,
  getRepositoryPortChoices,
  readApplicationPortSource,
  parseRepositoryPortMetadata,
  getDrivenRepositoryInfrastructurePackageChoices,
} = require("../lib/index.cjs");
const {
  getEntityNotFoundErrorSpec,
  appendEnsureEntityNotFoundErrorActions,
} = require("../lib/entity-not-found-error.cjs");

const repoRoot = getRepoRoot();

/**
 * @param {{ name: string, params: string, returnType: string }} method
 * @param {string} entityClassName e.g. DocumentEntity
 * @param {string} entityKebab e.g. document (for DataLoader cache key)
 */
function isGetByIdWithStringId(method, entityClassName) {
  if (method.name !== "getById") return false;
  const first = method.params.split(",")[0]?.trim() ?? "";
  if (!/:\s*string\s*$/.test(first)) return false;
  if (!method.returnType.includes("Promise")) return false;
  return method.returnType.includes(entityClassName);
}

/**
 * @param {string} params "documentId: string" -> "documentId"
 */
function firstParamName(params) {
  const first = params.split(",")[0]?.trim() ?? "";
  const m = first.match(/^(\w+)\s*:/);
  return m ? m[1] : "id";
}

/**
 * @param {{ name: string, params: string, returnType: string }[]} methods
 * @param {string} entityClassName
 * @param {string} entityKebab
 * @param {string} notFoundErrorClassName e.g. UserNotFoundError
 */
function buildMethodBodies(methods, entityClassName, entityKebab, notFoundErrorClassName) {
  const usesBatchFetch = methods.some((m) => isGetByIdWithStringId(m, entityClassName));
  let code = "";

  for (const method of methods) {
    if (isGetByIdWithStringId(method, entityClassName)) {
      const idParam = firstParamName(method.params);
      code += `
  async ${method.name}(${method.params}): ${method.returnType} {
    const loader = this.deps.loaders.getOrCreate(
      "${entityKebab}.byId",
      () =>
        new DataLoader<string, ${entityClassName}>(async (ids: string[]) => {
          return this.fetchManyByIds([...ids]);
        })
    );

    return loader.load(${idParam});
  }
`;
    } else {
      code += `
  ${method.name}(${method.params}): ${method.returnType} {
    throw new Error("Not implemented");
  }
`;
    }
  }

  if (usesBatchFetch) {
    code += `
  private async fetchManyByIds(
    ids: string[]
  ): Promise<(${entityClassName} | Error)[]> {
    const correlationId = this.deps.getCorrelationId();

    const raw = await this.deps.httpClient
      // FIXME replace with real fetch details
      .post("documents/batch", {
        json: { ids },
        headers: {
          "x-correlation-id": correlationId,
        },
      })
      .json<unknown>();

    const entities = this.mapRawBatchToEntities(raw);
    const byId = new Map(entities.map((entity) => [entity.id, entity] as const));

    return ids.map((id) => {
      const entity = byId.get(id);
      return entity ?? new ${notFoundErrorClassName}(id);
    });
  }

  private mapRawBatchToEntities(_raw: unknown): ${entityClassName}[] {
    // TODO use proper mapper
    return [];
  }
`;
  }

  return code;
}

/**
 * @param {object} p
 */
function buildRepositorySource(p) {
  const {
    applicationPackage,
    domainPackage,
    entityClassName,
    entityPascal,
    repositoryBaseName,
    interfaceName,
    methods,
  } = p;

  const entityKebab = toKebabCase(entityPascal);
  const className = `${toPascalCase(repositoryBaseName)}Repository`;
  const usesBatchFetch = methods.some((m) => isGetByIdWithStringId(m, entityClassName));
  const notFoundSpec = usesBatchFetch ? getEntityNotFoundErrorSpec(entityPascal) : null;
  const methodBodies = buildMethodBodies(
    methods,
    entityClassName,
    entityKebab,
    notFoundSpec ? notFoundSpec.className : ""
  );

  const notFoundImport = notFoundSpec
    ? `import { ${notFoundSpec.className} } from '@domain/${domainPackage}/errors';\n`
    : "";

  return `import DataLoader from "dataloader";
import type { KyInstance } from "ky";

import type { ${interfaceName} } from "@application/${applicationPackage}/ports";
import type { DataLoaderRegistry } from "@infrastructure/lib-dataloader";
import type { ${entityClassName} } from "@domain/${domainPackage}/entities";
${notFoundImport}
export class ${className} implements ${interfaceName} {
  constructor(
    private readonly deps: {
      httpClient: KyInstance;
      loaders: DataLoaderRegistry;
      getCorrelationId: () => string;
    }
  ) {}
${methodBodies}}
`;
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDrivenRepositoryAddRepositoryGenerator(plop) {
  plop.setGenerator("driven-repository-add-repository", {
    description:
      "Add a opinionated repository class (Ky + DataLoader) implementing an application port to a driven-repository-* package",
    prompts: [
      {
        type: "list",
        name: "applicationPackage",
        message: "Select application package (source Port):",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "portFile",
        message: "Select repository Port (from src/ports/*.repository.port.ts):",
        choices: (answers) => {
          const ports = getRepositoryPortChoices(repoRoot, answers.applicationPackage);
          if (!ports.length) {
            throw new Error(
              `No repository Port (*.repository.port.ts) in application package "${answers.applicationPackage}". Create one with application-port (repository kind).`
            );
          }
          return ports;
        },
      },
      {
        type: "list",
        name: "drivenPackage",
        message: "Select driven-repository-* infrastructure package:",
        choices: () => {
          const c = getDrivenRepositoryInfrastructurePackageChoices(repoRoot);
          if (!c.length) {
            throw new Error(
              'No driven-repository-* packages found. Create one with "infrastructure-driven-adapter-package" (repository = yes).'
            );
          }
          return c;
        },
      },
      {
        type: "input",
        name: "repositoryBaseName",
        message:
          "Repository base name (e.g. RestDocument → RestDocumentRepository). PascalCase, no Repository suffix. Leave empty to infer from entity (e.g. User → UserRepository):",
        validate: (value) => {
          const v = String(value || "").trim();
          if (!v) return true;
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(v)) {
            return "Use PascalCase (e.g. RestDocument)";
          }
          return true;
        },
        filter: (value) => String(value || "").trim(),
      },
    ],
    actions: (data) => {
      const { applicationPackage, portFile, drivenPackage } = data;

      const portSource = readApplicationPortSource(repoRoot, applicationPackage, portFile);
      const { domainPackage, entityClassName, entityPascal } =
        parseRepositoryPortMetadata(portSource);

      const rawBase = String(data.repositoryBaseName || "").trim();
      const repositoryBaseName = toPascalCase(rawBase || entityPascal);
      if (!repositoryBaseName) {
        throw new Error(
          "Could not infer repository base name: provide a name or ensure the port imports an entity type."
        );
      }

      const base = portFile.replace(/\.repository\.port\.ts$/, "");
      const pascalBase = toPascalCase(base);
      const interfaceName = `${pascalBase}Port`;
      const methods = parseInterfaceMethods(portSource, interfaceName);

      if (!methods.length) {
        throw new Error(`No methods found in Port interface ${interfaceName} (file ${portFile}).`);
      }

      const source = buildRepositorySource({
        applicationPackage,
        domainPackage,
        entityClassName,
        entityPascal,
        repositoryBaseName,
        interfaceName,
        methods,
      });

      const fileBase = `${toKebabCase(repositoryBaseName)}.repository`;
      const repoRelPath = `../packages/infrastructure/${drivenPackage}/src/repositories/${fileBase}.ts`;
      const repoAbsPath = path.join(
        repoRoot,
        "packages",
        "infrastructure",
        drivenPackage,
        "src",
        "repositories",
        `${fileBase}.ts`
      );

      if (fs.existsSync(repoAbsPath)) {
        throw new Error(
          `Repository file already exists: ${repoAbsPath}. Remove it or pick another repository name.`
        );
      }

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      const usesBatchFetch = methods.some((m) => isGetByIdWithStringId(m, entityClassName));
      if (usesBatchFetch) {
        appendEnsureEntityNotFoundErrorActions(actions, {
          repoRoot,
          domainPackage,
          entityPascal,
        });
      }

      actions.push({
        type: "add",
        path: repoRelPath,
        template: source,
      });

      actions.push({
        type: "add",
        path: `../packages/infrastructure/${drivenPackage}/src/repositories/index.ts`,
        template: "export {};\n",
        skipIfExists: true,
      });

      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${drivenPackage}/src/repositories/index.ts`,
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${fileBase}';`;

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const content = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${content}${exportLine}\n`;
        },
      });

      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${drivenPackage}/src/index.ts`,
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = "export * from './repositories';";

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const content = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${content}${exportLine}\n`;
        },
      });

      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${drivenPackage}/package.json`,
        transform: (file) => {
          const pkg = JSON.parse(file);
          pkg.dependencies = pkg.dependencies || {};

          const deps = {
            [`@application/${applicationPackage}`]: "workspace:*",
            [`@domain/${domainPackage}`]: "workspace:*",
            "@infrastructure/lib-dataloader": "workspace:*",
            dataloader: "^2.2.2",
            ky: "^1.14.0",
          };

          for (const [name, spec] of Object.entries(deps)) {
            if (!pkg.dependencies[name]) {
              pkg.dependencies[name] = spec;
            }
          }

          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      return actions;
    },
  });
};
