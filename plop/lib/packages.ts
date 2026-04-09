import fs from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import { toPascalCase } from "./casing.ts";
import { resolveWorkspaceDependencyVersion } from "./workspace-dependency-version.ts";
import { scanPortImplementations } from "./scan-infrastructure-port-implementations.ts";
/** @param {string} repoRoot */
function layerRoot(repoRoot: string, layer: string) {
  return path.join(repoRoot, "packages", layer);
}
/**
 * @param {string} repoRoot
 * @param {string} layer e.g. "application", "domain"
 * @param {string} packageName
 * @param {...string} segments
 */
function packagePath(repoRoot: string, layer: string, packageName: string, ...segments: string[]) {
  return path.join(repoRoot, "packages", layer, packageName, ...segments);
}
/**
 * @param {string} absDir
 * @param {{ exclude?: string[] }} [options]
 * @returns {string[]}
 */
function listChildDirectoryNames(
  absDir: string,
  options: {
    exclude?: string[];
  } = {}
) {
  const exclude = new Set(options.exclude || []);
  if (!fs.existsSync(absDir)) {
    return [];
  }
  return fs
    .readdirSync(absDir, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isDirectory() && !exclude.has(entry.name))
    .map((entry: Dirent) => entry.name)
    .sort();
}
/** @param {string[]} names */
function toPlopChoices(names: string[]) {
  return names.map((name: string) => ({ name, value: name }));
}
/** @param {string} repoRoot */
function getApplicationPackageChoices(repoRoot: string) {
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
function getApplicationModuleFileChoices(repoRoot: string, applicationPackage: string) {
  const modulesDir = packagePath(repoRoot, "application", applicationPackage, "src", "modules");
  if (!fs.existsSync(modulesDir)) {
    return [];
  }
  return fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith(".module.ts"))
    .map((entry: Dirent) => ({
      name: entry.name,
      value: entry.name,
    }))
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
}
/**
 * Application packages (excluding core) that have at least one `src/modules/*.module.ts`.
 * @param {string} repoRoot
 * @returns {{ name: string, value: string }[]}
 */
function getApplicationPackagesWithModulesChoices(repoRoot: string) {
  const names = listChildDirectoryNames(layerRoot(repoRoot, "application"), {
    exclude: ["core"],
  });
  const withModules = names.filter(
    (n: string) => getApplicationModuleFileChoices(repoRoot, n).length > 0
  );
  return toPlopChoices(withModules);
}
/**
 * @param {string} repoRoot
 * @param {{ excludeCore?: boolean }} [options] excludeCore defaults to true
 */
function getDomainPackageChoices(
  repoRoot: string,
  options: {
    excludeCore?: boolean;
  } = {}
) {
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
function getDomainPackageNamesOrThrow(
  repoRoot: string,
  options: {
    excludeCore?: boolean;
  } = {}
) {
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
function getCompositionPackageChoices(repoRoot: string) {
  return toPlopChoices(listChildDirectoryNames(layerRoot(repoRoot, "composition")));
}
/** @param {string} repoRoot */
function getInfrastructurePackageChoices(repoRoot: string) {
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
function getInfrastructurePackagesWithPortImplementationsChoices(repoRoot: string) {
  const root = layerRoot(repoRoot, "infrastructure");
  const folders = listChildDirectoryNames(root);
  const withAdapters = folders.filter(
    (folder: string) => scanPortImplementations(repoRoot, folder).length > 0
  );
  return toPlopChoices(withAdapters);
}
/** driven-* packages only */
function getDrivenInfrastructurePackageChoices(repoRoot: string) {
  const root = layerRoot(repoRoot, "infrastructure");
  if (!fs.existsSync(root)) {
    return [];
  }
  const names = listChildDirectoryNames(root).filter((n: string) => n.startsWith("driven-"));
  return toPlopChoices(names);
}
/** driven-repository-* packages only */
function getDrivenRepositoryInfrastructurePackageChoices(repoRoot: string) {
  const root = layerRoot(repoRoot, "infrastructure");
  if (!fs.existsSync(root)) {
    return [];
  }
  const names = listChildDirectoryNames(root).filter((n: string) =>
    n.startsWith("driven-repository-")
  );
  return toPlopChoices(names);
}
/** @param {string} filePath */
function readUtf8File(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}
/** @param {string} repoRoot */
function applicationPortsDir(repoRoot: string, applicationPackage: string) {
  return packagePath(repoRoot, "application", applicationPackage, "src", "ports");
}
/**
 * @param {string} repoRoot
 * @param {string} applicationPackage
 * @returns {{ name: string, value: string }[]}
 */
function getNormalPortChoices(repoRoot: string, applicationPackage: string) {
  const portsDir = applicationPortsDir(repoRoot, applicationPackage);
  if (!fs.existsSync(portsDir)) {
    return [];
  }
  return fs
    .readdirSync(portsDir, { withFileTypes: true })
    .filter(
      (entry: Dirent) =>
        entry.isFile() &&
        entry.name.endsWith(".port.ts") &&
        !entry.name.endsWith(".interaction.port.ts") &&
        !entry.name.endsWith(".repository.port.ts")
    )
    .map((entry: Dirent) => {
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
function getRepositoryPortChoices(repoRoot: string, applicationPackage: string) {
  const portsDir = applicationPortsDir(repoRoot, applicationPackage);
  if (!fs.existsSync(portsDir)) {
    return [];
  }
  return fs
    .readdirSync(portsDir, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith(".repository.port.ts"))
    .map((entry: Dirent) => {
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
function parseRepositoryPortMetadata(source: string) {
  const m = source.match(
    /import\s+type\s+\{\s*(\w+)\s*\}\s+from\s+["']@domain\/([^/]+)\/entities["']\s*;/
  );
  if (!m?.[1] || !m[2]) {
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
function parseRepositoryPortInterfaceName(source: string) {
  const all = [...source.matchAll(/export\s+interface\s+(\w+)\s*\{/g)];
  if (all.length === 0) {
    throw new Error("Could not parse repository port: expected export interface Name { ... }");
  }
  const names = all.map((m: RegExpMatchArray) => m[1] as string);
  const withSuffix = names.find((n: string) => n.endsWith("RepositoryPort"));
  const chosen = withSuffix ?? names[0];
  if (!chosen) {
    throw new Error("Could not parse repository port interface names.");
  }
  return chosen;
}
/**
 * @param {string} repoRoot
 * @param {string} applicationPackage
 */
function getInteractionPortChoices(repoRoot: string, applicationPackage: string) {
  const portsDir = applicationPortsDir(repoRoot, applicationPackage);
  if (!fs.existsSync(portsDir)) {
    return [];
  }
  return fs
    .readdirSync(portsDir, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith(".interaction.port.ts"))
    .map((entry: Dirent) => {
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
function readApplicationPortSource(
  repoRoot: string,
  applicationPackage: string,
  portFileName: string
) {
  const filePath = path.join(applicationPortsDir(repoRoot, applicationPackage), portFileName);
  return readUtf8File(filePath);
}
/**
 * @param {string} repoRoot
 * @param {string} domainPackage
 */
function getDomainEntityChoices(repoRoot: string, domainPackage: string) {
  const entitiesDir = packagePath(repoRoot, "domain", domainPackage, "src", "entities");
  if (!fs.existsSync(entitiesDir)) {
    throw new Error(
      `Domain package "${domainPackage}" has no entities folder. Expected path: ${entitiesDir}`
    );
  }
  const entities = fs
    .readdirSync(entitiesDir, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith(".entity.ts"))
    .map((entry: Dirent) => {
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
function getApplicationFlowCheckboxChoices(repoRoot: string, applicationPackage: string) {
  const flowsDir = packagePath(repoRoot, "application", applicationPackage, "src", "flows");
  if (!fs.existsSync(flowsDir)) {
    return [];
  }
  return fs
    .readdirSync(flowsDir, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith(".flow.ts"))
    .map((entry: Dirent) => {
      const base = entry.name.replace(/\.flow\.ts$/, "");
      const pascal = toPascalCase(base);
      return {
        name: `${pascal}Flow (${entry.name})`,
        value: pascal,
      };
    })
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
}
function getApplicationFlowChoices(repoRoot: string, applicationPackage: string) {
  const flowsDir = packagePath(repoRoot, "application", applicationPackage, "src", "flows");
  if (!fs.existsSync(flowsDir)) {
    throw new Error(`Application package "${applicationPackage}" has no flows folder.`);
  }
  const flows = fs
    .readdirSync(flowsDir, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith(".flow.ts"))
    .map((entry: Dirent) => {
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
function getApplicationUseCaseCheckboxChoices(repoRoot: string, applicationPackage: string) {
  const useCasesDir = packagePath(repoRoot, "application", applicationPackage, "src", "use-cases");
  if (!fs.existsSync(useCasesDir)) {
    return [];
  }
  return fs
    .readdirSync(useCasesDir, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith(".use-case.ts"))
    .map((entry: Dirent) => {
      const base = entry.name.replace(/\.use-case\.ts$/, "");
      const pascal = toPascalCase(base);
      return {
        name: `${pascal}UseCase (${entry.name})`,
        value: pascal,
      };
    })
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
}
function getApplicationUseCaseChoices(repoRoot: string, applicationPackage: string) {
  const useCasesDir = packagePath(repoRoot, "application", applicationPackage, "src", "use-cases");
  if (!fs.existsSync(useCasesDir)) {
    throw new Error(`Application package "${applicationPackage}" has no use-cases folder.`);
  }
  const useCases = fs
    .readdirSync(useCasesDir, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith(".use-case.ts"))
    .map((entry: Dirent) => {
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
function getCompositionEntryIndexPath(repoRoot: string, compositionPackage: string) {
  return path.join(packagePath(repoRoot, "composition", compositionPackage, "src"), "index.ts");
}
/** @param {string} filePath */
function readPackageJson(filePath: string) {
  return JSON.parse(readUtf8File(filePath));
}
/** @param {string} filePath @param {object} pkg */
function writePackageJson(filePath: string, pkg: Record<string, unknown>) {
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}
/**
 * @param {string} repoRoot
 * @param {string} layer
 * @param {string} packageName
 */
function packageJsonPath(repoRoot: string, layer: string, packageName: string) {
  return packagePath(repoRoot, layer, packageName, "package.json");
}
/**
 * Ensure zod is in dependencies (domain generators).
 * @returns {string} status message for Plop `message` actions
 */
function ensureZodDependencyInDomainPackage(repoRoot: string, domainPackageName: string) {
  const pkgPath = packageJsonPath(repoRoot, "domain", domainPackageName);
  if (!fs.existsSync(pkgPath)) return "package.json not found, skipped zod dependency";
  const pkg = readPackageJson(pkgPath);
  pkg.dependencies = pkg.dependencies || {};
  if (!pkg.dependencies.zod) {
    pkg.dependencies.zod = resolveWorkspaceDependencyVersion(repoRoot, "zod") || "^3.23.8";
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
function renderCompositionPackageSrcTemplate(compositionFolderName: string, srcFileName: string) {
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
function getDefaultCompositionEntryTs(compositionFolderName: string) {
  return renderCompositionPackageSrcTemplate(compositionFolderName, "index.ts.hbs");
}
/**
 * Create `src/types.ts`, `src/infrastructure.ts`, and `src/index.ts` if `index.ts` is missing.
 * @param {string} repoRoot
 * @param {string} compositionPackage
 */
function ensureCompositionEntryFile(repoRoot: string, compositionPackage: string) {
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
function sortCompositionExportEntries(exportsObj: Record<string, string>) {
  const keys = Object.keys(exportsObj);
  keys.sort((a: string, b: string) => {
    if (a === ".") return -1;
    if (b === ".") return 1;
    return a.localeCompare(b);
  });
  const sorted: Record<string, string> = {};
  const exp = exportsObj as Record<string, string>;
  for (const k of keys) {
    const v = exp[k];
    if (v !== undefined) sorted[k] = v;
  }
  return sorted;
}
/**
 * Ensure package.json has a root export to `src/index.ts` (idempotent). Mutates `pkg`.
 * @param {Record<string, unknown>} pkg
 */
function ensureCompositionPackageRootExport(pkg: Record<string, unknown>) {
  let prev: Record<string, string> = {};
  if (pkg.exports && typeof pkg.exports === "object" && !Array.isArray(pkg.exports)) {
    prev = { ...(pkg.exports as Record<string, string>) };
  }
  if (prev["."] == null) {
    prev["."] = "./src/index.ts";
  }
  pkg.exports = sortCompositionExportEntries(prev);
}
/**
 * @param {string} repoRoot
 * @param {string} compositionPackage
 */
function assertCompositionEntryIndexExists(repoRoot: string, compositionPackage: string) {
  const p = getCompositionEntryIndexPath(repoRoot, compositionPackage);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Missing composition entry for @composition/${compositionPackage} (expected ${path.relative(repoRoot, p)}). ` +
        `Run composition-package or create src/index.ts manually.`
    );
  }
}
export {
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
