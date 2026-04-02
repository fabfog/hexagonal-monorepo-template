const fs = require("fs");
const path = require("path");

/** Matches existing barrel templates (`export {};`). */
const INITIAL_BARREL = "export {};\n";

/** @type {readonly string[]} */
const DOMAIN_SLICES = ["entities", "value-objects", "errors", "services"];

/** @type {readonly string[]} */
const APPLICATION_SLICES = ["ports", "flows", "use-cases", "dtos", "mappers", "modules"];

/**
 * @param {readonly string[]} allowed
 * @param {string} slice
 */
function assertSlice(allowed, slice) {
  if (!allowed.includes(slice)) {
    throw new Error(`Invalid slice "${slice}". Expected one of: ${allowed.join(", ")}`);
  }
}

/**
 * @param {string} pkgDir absolute path to package root
 * @param {string} slice directory name under src/
 */
function mergePackageExport(pkgDir, slice) {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  const raw = fs.readFileSync(pkgJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  if (!pkg.exports || typeof pkg.exports !== "object" || Array.isArray(pkg.exports)) {
    pkg.exports = {};
  }
  const key = `./${slice}`;
  const rel = `./src/${slice}/index.ts`;
  if (!pkg.exports[key]) {
    pkg.exports[key] = rel;
  }
  fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

/**
 * Ensure `src/<slice>/index.ts` and `package.json` export for `@domain/*`.
 * @param {string} repoRoot
 * @param {string} domainPackage kebab folder name
 * @param {typeof DOMAIN_SLICES[number]} slice
 */
function ensureDomainPackageSlice(repoRoot, domainPackage, slice) {
  assertSlice(DOMAIN_SLICES, slice);
  const pkgDir = path.join(repoRoot, "packages", "domain", domainPackage);
  const sliceDir = path.join(pkgDir, "src", slice);
  const indexPath = path.join(sliceDir, "index.ts");
  fs.mkdirSync(sliceDir, { recursive: true });
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, INITIAL_BARREL, "utf8");
  }
  mergePackageExport(pkgDir, slice);
}

/**
 * Ensure `src/<slice>/index.ts` and `package.json` export for `@application/*`.
 * @param {string} repoRoot
 * @param {string} applicationPackage kebab folder name
 * @param {typeof APPLICATION_SLICES[number]} slice
 */
function ensureApplicationPackageSlice(repoRoot, applicationPackage, slice) {
  assertSlice(APPLICATION_SLICES, slice);
  const pkgDir = path.join(repoRoot, "packages", "application", applicationPackage);
  const sliceDir = path.join(pkgDir, "src", slice);
  const indexPath = path.join(sliceDir, "index.ts");
  fs.mkdirSync(sliceDir, { recursive: true });
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, INITIAL_BARREL, "utf8");
  }
  mergePackageExport(pkgDir, slice);
}

module.exports = {
  ensureDomainPackageSlice,
  ensureApplicationPackageSlice,
  DOMAIN_SLICES,
  APPLICATION_SLICES,
  INITIAL_BARREL,
};
