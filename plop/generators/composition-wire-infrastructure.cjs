const {
  getRepoRoot,
  getCompositionPackageChoices,
  getDrivenInfrastructurePackageChoices,
  COMPOSITION_RUNTIMES,
  ensureCompositionRuntimeFiles,
  mergeCompositionPackageExports,
} = require("../lib");

const repoRoot = getRepoRoot();

/**
 * @param {string} drivenPackage
 */
function isDrivenRepositoryPackage(drivenPackage) {
  return typeof drivenPackage === "string" && drivenPackage.startsWith("driven-repository-");
}

/**
 * @param {string} src
 * @returns {{ openIdx: number, closeIdx: number } | null}
 */
function findInfrastructureObjectBlock(src) {
  const re = /export\s+const\s+infrastructure\s*=\s*\{/;
  const m = src.match(re);
  if (!m || m.index === undefined) return null;
  const openIdx = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { openIdx, closeIdx: i };
    }
  }
  return null;
}

/**
 * @param {string} src
 * @param {string} importLine full line including newline not required
 */
function insertAfterLastImport(src, importLine) {
  const lines = src.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine);
  } else {
    lines.unshift(importLine, "");
  }
  return lines.join("\n");
}

/**
 * @param {string} src
 * @param {string[]} importLines
 */
function ensureImportLines(src, importLines) {
  let out = src;
  for (const line of importLines) {
    const trimmed = line.trim();
    const fromMatch = trimmed.match(/from\s+["']([^"']+)["']/);
    const specifier = fromMatch ? fromMatch[1] : "";
    const hasSameModule =
      specifier !== "" && (out.includes(`"${specifier}"`) || out.includes(`'${specifier}'`));
    if (hasSameModule || (specifier === "" && out.includes(trimmed))) {
      continue;
    }
    out = insertAfterLastImport(out, trimmed);
  }
  return out;
}

/**
 * @param {string} adapterClassName
 * @param {string} drivenPackage
 * @param {string} runtime
 * @param {boolean} useKyHttpClient
 */
function buildRepositoryImportLines(adapterClassName, drivenPackage, runtime, useKyHttpClient) {
  const lines = [
    ...(useKyHttpClient ? [`import { createHttpClient } from "@infrastructure/lib-http";`] : []),
    `import { ${adapterClassName} } from "@infrastructure/${drivenPackage}";`,
  ];
  if (runtime === "server") {
    lines.push(`import { getServerDataLoaderRegistry } from "./get-data-loader-registry";`);
  } else if (runtime === "client") {
    lines.push(`import { createDataLoaderRegistry } from "./data-loader-registry";`);
  } else {
    lines.push(`import { createDataLoaderRegistry } from "@infrastructure/lib-dataloader";`);
  }
  return lines;
}

/**
 * @param {string} runtime
 */
function buildRepositoryLoadersCall(runtime) {
  if (runtime === "server") return "getServerDataLoaderRegistry()";
  return "createDataLoaderRegistry()";
}

/**
 * @param {string} src
 * @param {{ infrastructureKey: string, cacheVarName: string, adapterClassName: string, drivenPackage: string, runtime?: string, useKyHttpClient?: boolean }} p
 */
function mergeInfrastructureFile(src, p) {
  const runtime = p.runtime ?? "server";
  const isRepo = isDrivenRepositoryPackage(p.drivenPackage);
  const useKyHttpClient = p.useKyHttpClient !== false;
  const { infrastructureKey, cacheVarName, adapterClassName, drivenPackage } = p;

  const getterRe = new RegExp(`get\\s+${infrastructureKey}\\s*\\(`);
  if (getterRe.test(src)) {
    throw new Error(
      `infrastructure.${infrastructureKey} is already wired in this file. Choose another key or remove the existing getter.`
    );
  }

  const importLine = `import { ${adapterClassName} } from "@infrastructure/${drivenPackage}";`;

  const repoDepsInner = useKyHttpClient
    ? `{
        httpClient: createHttpClient(),
        loaders: ${buildRepositoryLoadersCall(runtime)},
        getCorrelationId: () => globalThis.crypto.randomUUID(),
      }`
    : `{
        loaders: ${buildRepositoryLoadersCall(runtime)},
        getCorrelationId: () => globalThis.crypto.randomUUID(),
      }`;

  const getterBlock = isRepo
    ? `  get ${infrastructureKey}() {
    if (${cacheVarName} === undefined) {
      ${cacheVarName} = new ${adapterClassName}(${repoDepsInner});
    }
    return ${cacheVarName};
  }`
    : `  get ${infrastructureKey}() {
    if (${cacheVarName} === undefined) {
      // TODO: pass constructor args (config, env, other ports, etc.)
      ${cacheVarName} = new ${adapterClassName}();
    }
    return ${cacheVarName};
  }`;

  let updated = src.trim().length ? src : "";

  if (!updated.includes("export const infrastructure")) {
    const headerImports = isRepo
      ? buildRepositoryImportLines(adapterClassName, drivenPackage, runtime, useKyHttpClient).join(
          "\n"
        ) + "\n"
      : `${importLine}\n`;
    const letLine = `let ${cacheVarName}: ${adapterClassName} | undefined;`;
    return `${headerImports}\n${letLine}\n\nexport const infrastructure = {\n${getterBlock},\n};\n`;
  }

  if (isRepo) {
    updated = ensureImportLines(
      updated,
      buildRepositoryImportLines(adapterClassName, drivenPackage, runtime, useKyHttpClient)
    );
  } else if (!updated.includes(importLine)) {
    updated = insertAfterLastImport(updated, importLine);
  }

  const letLine = `let ${cacheVarName}: ${adapterClassName} | undefined;`;
  if (!updated.includes(letLine)) {
    const infraDecl = updated.indexOf("export const infrastructure");
    if (infraDecl === -1) {
      throw new Error("Could not find export const infrastructure");
    }
    const before = updated.slice(0, infraDecl).trimEnd();
    updated = `${before}\n\n${letLine}\n\n${updated.slice(infraDecl)}`;
  }

  const block = findInfrastructureObjectBlock(updated);
  if (!block) {
    throw new Error("Could not parse infrastructure object block");
  }
  const { openIdx, closeIdx } = block;
  const innerRaw = updated.slice(openIdx + 1, closeIdx);
  const trimmedEnd = innerRaw.trimEnd();
  const needsComma = trimmedEnd.length > 0 && !trimmedEnd.endsWith(",");
  const newInner = `${innerRaw}${needsComma ? "," : ""}\n${getterBlock},\n`;
  updated = updated.slice(0, openIdx + 1) + newInner + updated.slice(closeIdx);

  return updated.endsWith("\n") ? updated : `${updated}\n`;
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionWireInfrastructureGenerator(plop) {
  plop.setGenerator("composition-wire-infrastructure", {
    description:
      "Wire a driven-* package into composition: lazy getters on infrastructure.ts + @infrastructure/* dependency. Repository packages get DataLoader + correlation; Ky is optional.",
    prompts: [
      {
        type: "list",
        name: "compositionPackage",
        message: "Select composition package:",
        choices: getCompositionPackageChoices(repoRoot),
      },
      {
        type: "checkbox",
        name: "runtimes",
        message: "Runtime(s) for this infrastructure:",
        choices: COMPOSITION_RUNTIMES.map((r) => ({ name: r, value: r })),
        validate: (value) =>
          Array.isArray(value) && value.length > 0 ? true : "Select at least one runtime",
      },
      {
        type: "list",
        name: "drivenPackage",
        message: "Select driven infrastructure package (source adapter):",
        choices: getDrivenInfrastructurePackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "infrastructureKey",
        message:
          "Property name on `infrastructure` (camelCase, e.g. cms, contentful, search). Used as infrastructure.cms etc.:",
        validate: (value) => {
          const v = String(value || "").trim();
          if (!v) return "Key cannot be empty";
          if (!/^[a-z][a-zA-Z0-9]*$/.test(v)) {
            return "Use a valid camelCase identifier (start with lowercase letter)";
          }
          return true;
        },
        filter: (value) => String(value || "").trim(),
      },
      {
        type: "input",
        name: "adapterClassName",
        message:
          "Adapter class name exported from the driven package (e.g. ContentfulAdapter, CiaoAdapter):",
        validate: (value) => String(value || "").trim().length > 0 || "Class name cannot be empty",
        filter: (value) => String(value || "").trim(),
      },
      {
        type: "confirm",
        name: "useKyHttpClient",
        default: true,
        message:
          "Wire Ky HTTP client (`createHttpClient`) into this repository? Choose No if the adapter uses an SDK only (e.g. Contentful):",
        when: (a) => isDrivenRepositoryPackage(String(a.drivenPackage || "")),
      },
    ],
    actions: (data) => {
      const { compositionPackage, runtimes, drivenPackage, infrastructureKey, adapterClassName } =
        data;

      const cacheVarName = `_${infrastructureKey}Instance`;
      const isRepo = isDrivenRepositoryPackage(drivenPackage);
      const useKyHttpClient = data.useKyHttpClient !== false;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      actions.push({
        type: "modify",
        path: `../packages/composition/${compositionPackage}/package.json`,
        transform: (file, data) => {
          for (const runtime of data.runtimes) {
            ensureCompositionRuntimeFiles(repoRoot, data.compositionPackage, runtime);
          }
          const pkg = JSON.parse(file);
          mergeCompositionPackageExports(pkg, data.runtimes);

          const infraDep = `@infrastructure/${drivenPackage}`;

          pkg.dependencies = pkg.dependencies || {};
          if (!pkg.dependencies[infraDep]) {
            pkg.dependencies[infraDep] = "workspace:*";
          }

          if (isRepo) {
            if (data.useKyHttpClient !== false && !pkg.dependencies["@infrastructure/lib-http"]) {
              pkg.dependencies["@infrastructure/lib-http"] = "workspace:*";
            }
            if (!pkg.dependencies["@infrastructure/lib-dataloader"]) {
              pkg.dependencies["@infrastructure/lib-dataloader"] = "workspace:*";
            }
          }

          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      for (const runtime of runtimes) {
        const infraDir = `src/${runtime}`;
        const infraPath = `../packages/composition/${compositionPackage}/${infraDir}/infrastructure.ts`;

        actions.push({
          type: "modify",
          path: infraPath,
          transform: (file) =>
            mergeInfrastructureFile(file, {
              drivenPackage,
              infrastructureKey,
              cacheVarName,
              adapterClassName,
              runtime,
              useKyHttpClient,
            }),
        });
      }

      return actions;
    },
  });
};
