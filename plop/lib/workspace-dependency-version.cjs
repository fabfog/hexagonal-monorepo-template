"use strict";

const fs = require("fs");
const path = require("path");

const FALLBACK_DEPENDENCY_VERSIONS = {
  vitest: "^4.1.0",
  zod: "^3.23.8",
};

/**
 * @param {string} spec
 * @returns {[number, number, number] | null}
 */
function parseSemverLike(spec) {
  const normalized = String(spec || "")
    .trim()
    .replace(/^[^\d]*/, "");
  const m = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareVersionSpecs(a, b) {
  const pa = parseSemverLike(a);
  const pb = parseSemverLike(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * @param {string} absDir
 * @param {string[]} out
 */
function collectPackageJsonPaths(absDir, out) {
  if (!fs.existsSync(absDir)) return;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".cursor")
      continue;
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      collectPackageJsonPaths(full, out);
      continue;
    }
    if (entry.isFile() && entry.name === "package.json") {
      out.push(full);
    }
  }
}

/**
 * @param {string} repoRoot
 * @returns {string[]}
 */
function getWorkspacePackageJsonPaths(repoRoot) {
  const out = [path.join(repoRoot, "package.json")];
  for (const folder of ["packages", "apps", "configs"]) {
    collectPackageJsonPaths(path.join(repoRoot, folder), out);
  }
  return out.filter((p, i, arr) => arr.indexOf(p) === i && fs.existsSync(p));
}

/**
 * @param {string} repoRoot
 * @param {string} depName
 * @returns {string | null}
 */
function resolveWorkspaceDependencyVersion(repoRoot, depName) {
  /** @type {string | null} */
  let best = null;
  for (const pkgJsonPath of getWorkspacePackageJsonPaths(repoRoot)) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    } catch {
      continue;
    }
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      const deps = pkg[field];
      if (!deps || typeof deps !== "object") continue;
      const found = deps[depName];
      if (typeof found !== "string") continue;
      if (best == null || compareVersionSpecs(found, best) > 0) {
        best = found;
      }
    }
  }
  return best ?? FALLBACK_DEPENDENCY_VERSIONS[depName] ?? null;
}

module.exports = {
  resolveWorkspaceDependencyVersion,
};
