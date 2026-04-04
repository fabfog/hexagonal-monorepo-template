const fs = require("fs");
const path = require("path");
const { toPascalCase } = require("./casing.cjs");

/** @param {string} repoRoot */
function layerRoot(repoRoot, layer) {
  return path.join(repoRoot, "packages", layer);
}

/**
 * @param {string} repoRoot
 * @param {string} layer e.g. "application", "domain"
 * @param {string} packageName
 * @param {...string} segments
 */
function packagePath(repoRoot, layer, packageName, ...segments) {
  return path.join(repoRoot, "packages", layer, packageName, ...segments);
}

/**
 * @param {string} absDir
 * @param {{ exclude?: string[] }} [options]
 * @returns {string[]}
 */
function listChildDirectoryNames(absDir, options = {}) {
  const exclude = new Set(options.exclude || []);
  if (!fs.existsSync(absDir)) {
    return [];
  }
  return fs
    .readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !exclude.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/** @param {string[]} names */
function toPlopChoices(names) {
  return names.map((name) => ({ name, value: name }));
}

/** @param {string} repoRoot */
function getApplicationPackageChoices(repoRoot) {
  const names = listChildDirectoryNames(layerRoot(repoRoot, "application"), {
    exclude: ["core"],
  });
  return toPlopChoices(names);
}

/**
 * Existing `*.module.ts` files under `src/modules/` (for progressive wiring).
 * @param {string} repoRoot
 * @param {string} applicationPackage
 * @returns {{ name: string, value: string }[]}
 */
function getApplicationModuleFileChoices(repoRoot, applicationPackage) {
  const modulesDir = packagePath(repoRoot, "application", applicationPackage, "src", "modules");
  if (!fs.existsSync(modulesDir)) {
    return [];
  }
  return fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".module.ts"))
    .map((entry) => ({
      name: entry.name,
      value: entry.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Application packages (excluding core) that have at least one `src/modules/*.module.ts`.
 * @param {string} repoRoot
 * @returns {{ name: string, value: string }[]}
 */
function getApplicationPackagesWithModulesChoices(repoRoot) {
  const names = listChildDirectoryNames(layerRoot(repoRoot, "application"), {
    exclude: ["core"],
  });
  const withModules = names.filter((n) => getApplicationModuleFileChoices(repoRoot, n).length > 0);
  return toPlopChoices(withModules);
}

/**
 * @param {string} repoRoot
 * @param {{ excludeCore?: boolean }} [options] excludeCore defaults to true
 */
function getDomainPackageChoices(repoRoot, options = {}) {
  const excludeCore = options.excludeCore !== false;
  const names = listChildDirectoryNames(layerRoot(repoRoot, "domain"), {
    exclude: excludeCore ? ["core"] : [],
  });
  return toPlopChoices(names);
}

/**
 * Domain package names; throws if packages/domain is missing.
 * @param {string} repoRoot
 * @param {{ excludeCore?: boolean }} [options]
 */
function getDomainPackageNamesOrThrow(repoRoot, options = {}) {
  const root = layerRoot(repoRoot, "domain");
  if (!fs.existsSync(root)) {
    throw new Error(`Domain packages folder is empty or missing. Expected path: ${root}`);
  }
  const excludeCore = options.excludeCore !== false;
  const names = listChildDirectoryNames(root, {
    exclude: excludeCore ? ["core"] : [],
  });
  return names;
}

/** @param {string} repoRoot */
function getCompositionPackageChoices(repoRoot) {
  return toPlopChoices(listChildDirectoryNames(layerRoot(repoRoot, "composition")));
}

/** @param {string} repoRoot */
function getInfrastructurePackageChoices(repoRoot) {
  const root = layerRoot(repoRoot, "infrastructure");
  if (!fs.existsSync(root)) {
    throw new Error(`Infrastructure packages folder is empty or missing. Expected path: ${root}`);
  }
  return toPlopChoices(listChildDirectoryNames(root));
}

/**
 * Infrastructure folders that export at least one class implementing a *Port / *InteractionPort.
 * @param {string} repoRoot
 * @returns {{ name: string, value: string }[]}
 */
function getInfrastructurePackagesWithPortImplementationsChoices(repoRoot) {
  const { scanPortImplementations } = require("./scan-infrastructure-port-implementations.cjs");
  const root = layerRoot(repoRoot, "infrastructure");
  const folders = listChildDirectoryNames(root);
  const withAdapters = folders.filter(
    (folder) => scanPortImplementations(repoRoot, folder).length > 0
  );
  return toPlopChoices(withAdapters);
}

/** driven-* packages only */
function getDrivenInfrastructurePackageChoices(repoRoot) {
  const root = layerRoot(repoRoot, "infrastructure");
  if (!fs.existsSync(root)) {
    return [];
  }
  const names = listChildDirectoryNames(root).filter((n) => n.startsWith("driven-"));
  return toPlopChoices(names);
}

/** driven-repository-* packages only */
function getDrivenRepositoryInfrastructurePackageChoices(repoRoot) {
  const root = layerRoot(repoRoot, "infrastructure");
  if (!fs.existsSync(root)) {
    return [];
  }
  const names = listChildDirectoryNames(root).filter((n) => n.startsWith("driven-repository-"));
  return toPlopChoices(names);
}

/** @param {string} filePath */
function readUtf8File(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

/** @param {string} repoRoot */
function applicationPortsDir(repoRoot, applicationPackage) {
  return packagePath(repoRoot, "application", applicationPackage, "src", "ports");
}

/**
 * @param {string} repoRoot
 * @param {string} applicationPackage
 * @returns {{ name: string, value: string }[]}
 */
function getNormalPortChoices(repoRoot, applicationPackage) {
  const portsDir = applicationPortsDir(repoRoot, applicationPackage);
  if (!fs.existsSync(portsDir)) {
    return [];
  }
  return fs
    .readdirSync(portsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".port.ts") &&
        !entry.name.endsWith(".interaction.port.ts") &&
        !entry.name.endsWith(".repository.port.ts")
    )
    .map((entry) => {
      const base = entry.name.replace(/\.port\.ts$/, "");
      const pascal = toPascalCase(base);
      const interfaceName = `${pascal}Port`;
      return {
        name: `${interfaceName} (${entry.name})`,
        value: entry.name,
      };
    });
}

/**
 * Repository ports only (*.repository.port.ts).
 * @param {string} repoRoot
 * @param {string} applicationPackage
 * @returns {{ name: string, value: string }[]}
 */
function getRepositoryPortChoices(repoRoot, applicationPackage) {
  const portsDir = applicationPortsDir(repoRoot, applicationPackage);
  if (!fs.existsSync(portsDir)) {
    return [];
  }
  return fs
    .readdirSync(portsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".repository.port.ts"))
    .map((entry) => {
      const base = entry.name.replace(/\.repository\.port\.ts$/, "");
      const pascal = toPascalCase(base);
      const interfaceName = `${pascal}Port`;
      return {
        name: `${interfaceName} (${entry.name})`,
        value: entry.name,
      };
    });
}

/**
 * Reads domain package + entity class from a repository port file source.
 * Expects: import type { UserEntity } from "@domain/<pkg>/entities";
 * @param {string} source
 * @returns {{ domainPackage: string, entityClassName: string, entityPascal: string }}
 */
function parseRepositoryPortMetadata(source) {
  const m = source.match(
    /import\s+type\s+\{\s*(\w+)\s*\}\s+from\s+["']@domain\/([^/]+)\/entities["']\s*;/
  );
  if (!m) {
    throw new Error(
      'Could not parse repository port: expected a line like import type { UserEntity } from "@domain/<pkg>/entities";'
    );
  }
  const entityClassName = m[1];
  const domainPackage = m[2];
  const entityPascal = entityClassName.endsWith("Entity")
    ? entityClassName.slice(0, -"Entity".length)
    : entityClassName;
  return { domainPackage, entityClassName, entityPascal };
}

/**
 * Reads the repository Port interface name from source (export interface … {).
 * Prefers a name ending with `RepositoryPort` when multiple interfaces exist.
 * @param {string} source
 * @returns {string}
 */
function parseRepositoryPortInterfaceName(source) {
  const all = [...source.matchAll(/export\s+interface\s+(\w+)\s*\{/g)];
  if (all.length === 0) {
    throw new Error("Could not parse repository port: expected export interface Name { ... }");
  }
  const names = all.map((m) => m[1]);
  const withSuffix = names.find((n) => n.endsWith("RepositoryPort"));
  return withSuffix ?? names[0];
}

/**
 * @param {string} repoRoot
 * @param {string} applicationPackage
 */
function getInteractionPortChoices(repoRoot, applicationPackage) {
  const portsDir = applicationPortsDir(repoRoot, applicationPackage);
  if (!fs.existsSync(portsDir)) {
    return [];
  }
  return fs
    .readdirSync(portsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".interaction.port.ts"))
    .map((entry) => {
      const base = entry.name.replace(/\.interaction\.port\.ts$/, "");
      const pascal = toPascalCase(base);
      const interfaceName = `${pascal}InteractionPort`;
      return {
        name: `${interfaceName} (${entry.name})`,
        value: entry.name,
      };
    });
}

/**
 * @param {string} repoRoot
 * @param {string} applicationPackage
 * @param {string} portFileName
 */
function readApplicationPortSource(repoRoot, applicationPackage, portFileName) {
  const filePath = path.join(applicationPortsDir(repoRoot, applicationPackage), portFileName);
  return readUtf8File(filePath);
}

/**
 * @param {string} repoRoot
 * @param {string} domainPackage
 */
function getDomainEntityChoices(repoRoot, domainPackage) {
  const entitiesDir = packagePath(repoRoot, "domain", domainPackage, "src", "entities");
  if (!fs.existsSync(entitiesDir)) {
    throw new Error(
      `Domain package "${domainPackage}" has no entities folder. Expected path: ${entitiesDir}`
    );
  }
  const entities = fs
    .readdirSync(entitiesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".entity.ts"))
    .map((entry) => {
      const base = entry.name.replace(/\.entity\.ts$/, "");
      const pascal = toPascalCase(base);
      return {
        name: `${pascal}Entity (${entry.name})`,
        value: pascal,
      };
    });
  if (!entities.length) {
    throw new Error(`Domain package "${domainPackage}" has no entities.`);
  }
  return entities;
}

/**
 * @param {string} repoRoot
 * @param {string} applicationPackage
 */
/**
 * Checkbox choices for wiring modules; empty if folder missing or no files.
 * @param {string} repoRoot
 * @param {string} applicationPackage
 * @returns {{ name: string, value: string }[]}
 */
function getApplicationFlowCheckboxChoices(repoRoot, applicationPackage) {
  const flowsDir = packagePath(repoRoot, "application", applicationPackage, "src", "flows");
  if (!fs.existsSync(flowsDir)) {
    return [];
  }
  return fs
    .readdirSync(flowsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".flow.ts"))
    .map((entry) => {
      const base = entry.name.replace(/\.flow\.ts$/, "");
      const pascal = toPascalCase(base);
      return {
        name: `${pascal}Flow (${entry.name})`,
        value: pascal,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getApplicationFlowChoices(repoRoot, applicationPackage) {
  const flowsDir = packagePath(repoRoot, "application", applicationPackage, "src", "flows");
  if (!fs.existsSync(flowsDir)) {
    throw new Error(`Application package "${applicationPackage}" has no flows folder.`);
  }
  const flows = fs
    .readdirSync(flowsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".flow.ts"))
    .map((entry) => {
      const base = entry.name.replace(/\.flow\.ts$/, "");
      const pascal = toPascalCase(base);
      return {
        name: `${pascal}Flow (${entry.name})`,
        value: pascal,
      };
    });
  if (!flows.length) {
    throw new Error(`Application package "${applicationPackage}" has no flows.`);
  }
  return flows;
}

/**
 * @param {string} repoRoot
 * @param {string} applicationPackage
 */
/**
 * Checkbox choices for wiring modules; empty if folder missing or no files.
 * @param {string} repoRoot
 * @param {string} applicationPackage
 * @returns {{ name: string, value: string }[]}
 */
function getApplicationUseCaseCheckboxChoices(repoRoot, applicationPackage) {
  const useCasesDir = packagePath(repoRoot, "application", applicationPackage, "src", "use-cases");
  if (!fs.existsSync(useCasesDir)) {
    return [];
  }
  return fs
    .readdirSync(useCasesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".use-case.ts"))
    .map((entry) => {
      const base = entry.name.replace(/\.use-case\.ts$/, "");
      const pascal = toPascalCase(base);
      return {
        name: `${pascal}UseCase (${entry.name})`,
        value: pascal,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getApplicationUseCaseChoices(repoRoot, applicationPackage) {
  const useCasesDir = packagePath(repoRoot, "application", applicationPackage, "src", "use-cases");
  if (!fs.existsSync(useCasesDir)) {
    throw new Error(`Application package "${applicationPackage}" has no use-cases folder.`);
  }
  const useCases = fs
    .readdirSync(useCasesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".use-case.ts"))
    .map((entry) => {
      const base = entry.name.replace(/\.use-case\.ts$/, "");
      const pascal = toPascalCase(base);
      return {
        name: `${pascal}UseCase (${entry.name})`,
        value: pascal,
      };
    });
  if (!useCases.length) {
    throw new Error(`Application package "${applicationPackage}" has no use-cases.`);
  }
  return useCases;
}

/**
 * Single composition entry: `src/index.ts` (one package = one wiring surface; use multiple packages for multiple surfaces).
 * @param {string} repoRoot
 * @param {string} compositionPackage
 */
function getCompositionEntryIndexPath(repoRoot, compositionPackage) {
  return path.join(packagePath(repoRoot, "composition", compositionPackage, "src"), "index.ts");
}

/** @param {string} filePath */
function readPackageJson(filePath) {
  return JSON.parse(readUtf8File(filePath));
}

/** @param {string} filePath @param {object} pkg */
function writePackageJson(filePath, pkg) {
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

/**
 * @param {string} repoRoot
 * @param {string} layer
 * @param {string} packageName
 */
function packageJsonPath(repoRoot, layer, packageName) {
  return packagePath(repoRoot, layer, packageName, "package.json");
}

/**
 * Ensure zod is in dependencies (domain generators).
 * @returns {string} status message for Plop `message` actions
 */
function ensureZodDependencyInDomainPackage(repoRoot, domainPackageName) {
  const pkgPath = packageJsonPath(repoRoot, "domain", domainPackageName);
  if (!fs.existsSync(pkgPath)) return "package.json not found, skipped zod dependency";

  const pkg = readPackageJson(pkgPath);
  pkg.dependencies = pkg.dependencies || {};
  if (!pkg.dependencies.zod) {
    pkg.dependencies.zod = "^3.23.8";
    writePackageJson(pkgPath, pkg);
    return "Added zod dependency to domain package";
  }
  return "zod already present in domain package dependencies";
}

/**
 * Render a composition-package `src/*.hbs` template (`{{pascalCase name}}` → PascalCase of folder).
 * @param {string} compositionFolderName kebab package folder (e.g. demo-web)
 * @param {string} srcFileName template file under templates/composition-package/src/ (e.g. index.ts.hbs)
 */
function renderCompositionPackageSrcTemplate(compositionFolderName, srcFileName) {
  const templatePath = path.join(
    __dirname,
    "..",
    "templates",
    "composition-package",
    "src",
    srcFileName
  );
  const raw = readUtf8File(templatePath);
  const pascal = toPascalCase(compositionFolderName);
  return raw.replace(/\{\{\s*pascalCase name\s*\}\}/g, pascal);
}

/**
 * Default `src/index.ts` for a composition package (same as rendered `index.ts.hbs`).
 * @param {string} compositionFolderName kebab package folder (e.g. demo-web)
 */
function getDefaultCompositionEntryTs(compositionFolderName) {
  return renderCompositionPackageSrcTemplate(compositionFolderName, "index.ts.hbs");
}

/**
 * Create `src/types.ts`, `src/infrastructure.ts`, and `src/index.ts` if `index.ts` is missing.
 * @param {string} repoRoot
 * @param {string} compositionPackage
 */
function ensureCompositionEntryFile(repoRoot, compositionPackage) {
  const srcDir = packagePath(repoRoot, "composition", compositionPackage, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  const indexPath = path.join(srcDir, "index.ts");
  if (!fs.existsSync(indexPath)) {
    const files = ["types.ts.hbs", "infrastructure.ts.hbs", "index.ts.hbs"];
    for (const hbs of files) {
      const outName = hbs.replace(/\.hbs$/, "");
      const outPath = path.join(srcDir, outName);
      fs.writeFileSync(
        outPath,
        renderCompositionPackageSrcTemplate(compositionPackage, hbs),
        "utf8"
      );
    }
  }
}

/**
 * @param {Record<string, string>} exportsObj
 */
function sortCompositionExportEntries(exportsObj) {
  const keys = Object.keys(exportsObj);
  keys.sort((a, b) => {
    if (a === ".") return -1;
    if (b === ".") return 1;
    return a.localeCompare(b);
  });
  const sorted = /** @type {Record<string, string>} */ ({});
  for (const k of keys) {
    sorted[k] = exportsObj[k];
  }
  return sorted;
}

/**
 * Ensure package.json has a root export to `src/index.ts` (idempotent). Mutates `pkg`.
 * @param {Record<string, unknown>} pkg
 */
function ensureCompositionPackageRootExport(pkg) {
  const prev =
    pkg.exports && typeof pkg.exports === "object" && !Array.isArray(pkg.exports)
      ? /** @type {Record<string, string>} */ ({ ...pkg.exports })
      : /** @type {Record<string, string>} */ ({});
  if (prev["."] == null) {
    prev["."] = "./src/index.ts";
  }
  pkg.exports = sortCompositionExportEntries(prev);
}

/**
 * @param {string} repoRoot
 * @param {string} compositionPackage
 */
function assertCompositionEntryIndexExists(repoRoot, compositionPackage) {
  const p = getCompositionEntryIndexPath(repoRoot, compositionPackage);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Missing composition entry for @composition/${compositionPackage} (expected ${path.relative(repoRoot, p)}). ` +
        `Run composition-package or create src/index.ts manually.`
    );
  }
}

module.exports = {
  layerRoot,
  packagePath,
  packageJsonPath,
  listChildDirectoryNames,
  toPlopChoices,
  getApplicationPackageChoices,
  getApplicationPackagesWithModulesChoices,
  getApplicationModuleFileChoices,
  getDomainPackageChoices,
  getDomainPackageNamesOrThrow,
  getCompositionPackageChoices,
  getInfrastructurePackageChoices,
  getInfrastructurePackagesWithPortImplementationsChoices,
  getDrivenInfrastructurePackageChoices,
  getDrivenRepositoryInfrastructurePackageChoices,
  readUtf8File,
  applicationPortsDir,
  getNormalPortChoices,
  getRepositoryPortChoices,
  parseRepositoryPortMetadata,
  parseRepositoryPortInterfaceName,
  getInteractionPortChoices,
  readApplicationPortSource,
  getDomainEntityChoices,
  getApplicationFlowCheckboxChoices,
  getApplicationFlowChoices,
  getApplicationUseCaseCheckboxChoices,
  getApplicationUseCaseChoices,
  readPackageJson,
  writePackageJson,
  ensureZodDependencyInDomainPackage,
  getCompositionEntryIndexPath,
  getDefaultCompositionEntryTs,
  ensureCompositionEntryFile,
  ensureCompositionPackageRootExport,
  assertCompositionEntryIndexExists,
};
