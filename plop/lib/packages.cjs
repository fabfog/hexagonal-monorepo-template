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

/** Runtime entry points for composition packages */
const COMPOSITION_RUNTIMES = /** @type {const} */ (["isomorphic", "server", "client"]);

/**
 * Path to feature dependencies.ts for a given runtime.
 * All runtimes under src/<runtime>/<feature>/dependencies.ts
 * @param {string} repoRoot
 * @param {string} compositionPackage
 * @param {string} featureName
 * @param {keyof typeof COMPOSITION_RUNTIMES} runtime
 */
function getFeatureDependenciesPath(repoRoot, compositionPackage, featureName, runtime) {
  const base = packagePath(repoRoot, "composition", compositionPackage, "src", runtime);
  return path.join(base, featureName, "dependencies.ts");
}

/**
 * Runtimes where a feature exists (has dependencies.ts).
 * @param {string} repoRoot
 * @param {string} compositionPackage
 * @param {string} featureName
 * @returns {Array<keyof typeof COMPOSITION_RUNTIMES>}
 */
function getRuntimesForFeature(repoRoot, compositionPackage, featureName) {
  return COMPOSITION_RUNTIMES.filter((r) => {
    const p = getFeatureDependenciesPath(repoRoot, compositionPackage, featureName, r);
    return fs.existsSync(p);
  });
}

/**
 * Path to infrastructure.ts for a given runtime.
 * @param {string} repoRoot
 * @param {string} compositionPackage
 * @param {keyof typeof COMPOSITION_RUNTIMES} runtime
 */
function getInfrastructurePath(repoRoot, compositionPackage, runtime) {
  const base = packagePath(repoRoot, "composition", compositionPackage, "src", runtime);
  return path.join(base, "infrastructure.ts");
}

/**
 * Path to entry index.ts for a given runtime.
 * @param {string} repoRoot
 * @param {string} compositionPackage
 * @param {keyof typeof COMPOSITION_RUNTIMES} runtime
 */
function getEntryIndexPath(repoRoot, compositionPackage, runtime) {
  const base = packagePath(repoRoot, "composition", compositionPackage, "src", runtime);
  return path.join(base, "index.ts");
}

/**
 * Subfolders of composition package src that contain dependencies.ts.
 * Scans src/isomorphic, src/server, src/client for <feature>/dependencies.ts.
 * Returns unique feature names.
 * @param {string} repoRoot
 * @param {string} compositionPackage
 */
function getCompositionFeatureChoices(repoRoot, compositionPackage) {
  const srcDir = packagePath(repoRoot, "composition", compositionPackage, "src");
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Composition package "${compositionPackage}" has no src folder.`);
  }
  const seen = new Set();
  const features = [];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const depsPath = path.join(dir, entry.name, "dependencies.ts");
        if (fs.existsSync(depsPath) && !seen.has(entry.name)) {
          seen.add(entry.name);
          features.push({ name: entry.name, value: entry.name });
        }
      }
    }
  }

  for (const runtime of COMPOSITION_RUNTIMES) {
    scanDir(path.join(srcDir, runtime));
  }

  if (!features.length) {
    throw new Error(
      `Composition package "${compositionPackage}" has no features with dependencies.ts. Create one first with "composition-feature-dependencies".`
    );
  }
  return features;
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

module.exports = {
  layerRoot,
  packagePath,
  packageJsonPath,
  listChildDirectoryNames,
  toPlopChoices,
  getApplicationPackageChoices,
  getDomainPackageChoices,
  getDomainPackageNamesOrThrow,
  getCompositionPackageChoices,
  getInfrastructurePackageChoices,
  getDrivenInfrastructurePackageChoices,
  getDrivenRepositoryInfrastructurePackageChoices,
  readUtf8File,
  applicationPortsDir,
  getNormalPortChoices,
  getRepositoryPortChoices,
  parseRepositoryPortMetadata,
  getInteractionPortChoices,
  readApplicationPortSource,
  getDomainEntityChoices,
  getApplicationFlowChoices,
  getApplicationUseCaseChoices,
  getCompositionFeatureChoices,
  readPackageJson,
  writePackageJson,
  ensureZodDependencyInDomainPackage,
  COMPOSITION_RUNTIMES,
  getFeatureDependenciesPath,
  getInfrastructurePath,
  getEntryIndexPath,
  getRuntimesForFeature,
};
