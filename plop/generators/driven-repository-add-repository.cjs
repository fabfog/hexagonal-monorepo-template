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
  parseRepositoryPortInterfaceName,
  getDrivenRepositoryInfrastructurePackageChoices,
} = require("../lib");
const {
  getEntityNotFoundErrorSpec,
  appendEnsureEntityNotFoundErrorActions,
} = require("../lib/entity-not-found-error.cjs");

const repoRoot = getRepoRoot();

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {{ name: string, params: string, returnType: string }} method
 * @param {string} entityClassName e.g. DocumentEntity
 * @param {string} entityPascal e.g. Document (for TicketId)
 */
function isGetByIdWithVoId(method, entityClassName, entityPascal) {
  if (method.name !== "getById") return false;
  const first = method.params.split(",")[0]?.trim() ?? "";
  const idTypePattern = new RegExp(`:\\s*${escapeRegExp(entityPascal)}Id\\s*$`);
  if (!idTypePattern.test(first)) return false;
  if (!method.returnType.includes("Promise")) return false;
  return method.returnType.includes(entityClassName);
}

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
 * @param {{ name: string, params: string, returnType: string }[]} methods
 * @param {string} entityClassName
 * @param {string} entityPascal
 */
function usesGetByIdBatch(methods, entityClassName, entityPascal) {
  return methods.some(
    (m) =>
      isGetByIdWithVoId(m, entityClassName, entityPascal) ||
      isGetByIdWithStringId(m, entityClassName)
  );
}

/**
 * @param {{ name: string, params: string, returnType: string }[]} methods
 * @param {string} entityClassName
 * @param {string} entityPascal
 * @returns {"vo" | "string" | null}
 */
function getBatchGetByIdKind(methods, entityClassName, entityPascal) {
  if (methods.some((m) => isGetByIdWithVoId(m, entityClassName, entityPascal))) {
    return "vo";
  }
  if (methods.some((m) => isGetByIdWithStringId(m, entityClassName))) {
    return "string";
  }
  return null;
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
 * @param {"vo" | "string"} kind
 */
function buildCreateByIdLoaderMethod(kind, entityPascal, entityClassName) {
  if (kind === "vo") {
    return `
  private createByIdLoader(): DataLoader<${entityPascal}Id, ${entityClassName}, string> {
    return new DataLoader<${entityPascal}Id, ${entityClassName}, string>(
      async (ids) => this.fetchManyByIds(ids.map((k) => k.value)),
      { cacheKeyFn: (key) => key.value }
    );
  }
`;
  }
  return `
  private createByIdLoader(): DataLoader<string, ${entityClassName}> {
    return new DataLoader<string, ${entityClassName}>(async (ids: string[]) => {
      return this.fetchManyByIds([...ids]);
    });
  }
`;
}

/**
 * @param {{ name: string, params: string, returnType: string }[]} methods
 * @param {string} entityClassName
 * @param {string} entityPascal e.g. Document
 * @param {string} entityKebab
 * @param {string} notFoundErrorClassName e.g. UserNotFoundError
 * @param {boolean} useKyHttpClient
 */
function buildMethodBodies(
  methods,
  entityClassName,
  entityPascal,
  entityKebab,
  notFoundErrorClassName,
  useKyHttpClient
) {
  const usesBatchFetch = usesGetByIdBatch(methods, entityClassName, entityPascal);
  const getByIdKind = getBatchGetByIdKind(methods, entityClassName, entityPascal);

  let code = "";

  for (const method of methods) {
    if (isGetByIdWithVoId(method, entityClassName, entityPascal)) {
      const idParam = firstParamName(method.params);
      code += `
  async ${method.name}(${method.params}): ${method.returnType} {
    return this.byIdLoader.load(${idParam});
  }
`;
    } else if (isGetByIdWithStringId(method, entityClassName)) {
      const idParam = firstParamName(method.params);
      code += `
  async ${method.name}(${method.params}): ${method.returnType} {
    return this.byIdLoader.load(${idParam});
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

  if (usesBatchFetch && getByIdKind) {
    code += buildCreateByIdLoaderMethod(getByIdKind, entityPascal, entityClassName);
  }

  if (usesBatchFetch) {
    const fetchBlock = useKyHttpClient
      ? `    const raw = await this.deps.httpClient
      // FIXME replace with real fetch details (HTTP context should be applied by composition / lib-http).
      .post("${entityKebab}", {
        json: { ids },
      })
      .json<unknown>();
`
      : `    // TODO: Batch-fetch \`ids\` via your SDK or data source.
    const raw: unknown = undefined;
`;

    code += `
  private async fetchManyByIds(
    ids: string[]
  ): Promise<(${entityClassName} | Error)[]> {
${fetchBlock}
    const entities = this.mapRawBatchToEntities(raw);
    // Domain entities store id as a value object; use the fast entity.id getter.
    const byId = new Map(
      entities.map((entity) => [entity.id, entity] as const)
    );

    return ids.map((id) => {
      const entity = byId.get(id);
      return entity ?? new ${notFoundErrorClassName}(id);
    });
  }

  // TODO: handle unknown type: validate incoming data, map to entities
  private mapRawBatchToEntities(_raw: unknown): ${entityClassName}[] {
    // TODO use proper mapper; ${entityPascal}Id is the entity id VO.
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
    useKyHttpClient,
  } = p;

  const entityKebab = toKebabCase(entityPascal);
  const className = `${toPascalCase(repositoryBaseName)}Repository`;
  const usesBatchFetch = usesGetByIdBatch(methods, entityClassName, entityPascal);
  const usesVoIdOnPort = methods.some((m) => isGetByIdWithVoId(m, entityClassName, entityPascal));
  const notFoundSpec = usesBatchFetch ? getEntityNotFoundErrorSpec(entityPascal) : null;
  const methodBodies = buildMethodBodies(
    methods,
    entityClassName,
    entityPascal,
    entityKebab,
    notFoundSpec ? notFoundSpec.className : "",
    useKyHttpClient
  );

  const notFoundImport = notFoundSpec
    ? `import { ${notFoundSpec.className} } from '@domain/${domainPackage}/errors';\n`
    : "";
  const idVoImport = usesVoIdOnPort
    ? `import type { ${entityPascal}Id } from "@domain/${domainPackage}/value-objects";\n`
    : "";
  const httpImport = useKyHttpClient
    ? `import type { HttpClient } from "@infrastructure/lib-http";\n`
    : "";
  const depsHttpClient = useKyHttpClient ? `      httpClient: HttpClient;\n` : "";

  const batchKind = getBatchGetByIdKind(methods, entityClassName, entityPascal);
  const byIdHandleType =
    batchKind === "vo"
      ? `IdleDataLoaderHandle<${entityPascal}Id, ${entityClassName}, string>`
      : batchKind === "string"
        ? `IdleDataLoaderHandle<string, ${entityClassName}>`
        : "";

  const infraImports = usesBatchFetch
    ? `import {
  DataLoader,
  createIdleDataLoader,
  type DataLoaderRegistry,
  type IdleDataLoaderHandle,
} from "@infrastructure/lib-dataloader";
`
    : `import type { DataLoaderRegistry } from "@infrastructure/lib-dataloader";
`;

  const byIdLoaderKeyConst = usesBatchFetch
    ? `const BY_ID_LOADER_KEY = "${entityKebab}.byId";

`
    : "";

  const byIdLoaderField = usesBatchFetch
    ? `  private readonly byIdLoader: ${byIdHandleType};

`
    : "";

  const constructorBlock = usesBatchFetch
    ? `  constructor(
    private readonly deps: {
${depsHttpClient}      loaders: DataLoaderRegistry;
    }
  ) {
    this.byIdLoader = createIdleDataLoader({
      registry: this.deps.loaders,
      loaderKey: BY_ID_LOADER_KEY,
      factory: () => this.createByIdLoader(),
    });
  }
`
    : `  constructor(
    private readonly deps: {
${depsHttpClient}      loaders: DataLoaderRegistry;
    }
  ) {}
`;

  return `${infraImports}${httpImport ? `${httpImport}\n` : ""}import type { ${interfaceName} } from "@application/${applicationPackage}/ports";
import type { ${entityClassName} } from "@domain/${domainPackage}/entities";
${idVoImport}${notFoundImport}
${byIdLoaderKeyConst}export class ${className} implements ${interfaceName} {
${byIdLoaderField}${constructorBlock}${methodBodies}}
`;
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDrivenRepositoryAddRepositoryGenerator(plop) {
  plop.setGenerator("driven-repository-add-repository", {
    description:
      "Add a repository (DataLoader registry + optional HTTP client) implementing an application port to a driven-repository-* package",
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
        type: "confirm",
        name: "useKyHttpClient",
        default: true,
        message:
          "Include shared HTTP client (`httpClient`) in generated code? Choose No if you will use an external SDK instead (e.g. Contentful):",
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

      const interfaceName = parseRepositoryPortInterfaceName(portSource);
      const methods = parseInterfaceMethods(portSource, interfaceName);

      if (!methods.length) {
        throw new Error(`No methods found in Port interface ${interfaceName} (file ${portFile}).`);
      }

      const useKyHttpClient = data.useKyHttpClient !== false;

      const source = buildRepositorySource({
        applicationPackage,
        domainPackage,
        entityClassName,
        entityPascal,
        repositoryBaseName,
        interfaceName,
        methods,
        useKyHttpClient,
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

      const usesBatchFetch = usesGetByIdBatch(methods, entityClassName, entityPascal);
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

          const useKy = data.useKyHttpClient !== false;
          const deps = {
            [`@application/${applicationPackage}`]: "workspace:*",
            [`@domain/${domainPackage}`]: "workspace:*",
            "@infrastructure/lib-dataloader": "workspace:*",
            ...(useKy ? { "@infrastructure/lib-http": "workspace:*" } : {}),
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
