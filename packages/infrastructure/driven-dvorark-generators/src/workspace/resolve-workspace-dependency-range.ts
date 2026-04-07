import fs from "node:fs";
import path from "node:path";

/** Fallbacks aligned with Plop `FALLBACK_DEPENDENCY_VERSIONS` in `workspace-dependency-version.cjs`. */
export const FALLBACK_DEPENDENCY_VERSIONS = {
  vitest: "^4.1.0",
  zod: "^3.23.8",
} as const;

export type WorkspaceToolingDependencyName = keyof typeof FALLBACK_DEPENDENCY_VERSIONS;

function parseSemverLike(spec: string): [number, number, number] | null {
  const normalized = String(spec || "")
    .trim()
    .replace(/^[^\d]*/, "");
  const m = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) {
    return null;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareVersionSpecs(a: string, b: string): number {
  const pa = parseSemverLike(a);
  const pb = parseSemverLike(b);
  if (!pa && !pb) {
    return 0;
  }
  if (!pa) {
    return -1;
  }
  if (!pb) {
    return 1;
  }
  for (let i = 0; i < 3; i += 1) {
    const av = pa[i]!;
    const bv = pb[i]!;
    if (av !== bv) {
      return av - bv;
    }
  }
  return 0;
}

function collectPackageJsonPaths(absDir: string, out: string[]): void {
  if (!fs.existsSync(absDir)) {
    return;
  }
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".cursor") {
      continue;
    }
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

function getWorkspacePackageJsonPaths(repoRoot: string): string[] {
  const out = [path.join(repoRoot, "package.json")];
  for (const folder of ["packages", "apps", "configs"] as const) {
    collectPackageJsonPaths(path.join(repoRoot, folder), out);
  }
  return out.filter((p, i, arr) => arr.indexOf(p) === i && fs.existsSync(p));
}

/**
 * Picks the highest semver-like range mentioning the dependency across the workspace
 * (same strategy as Plop `resolveWorkspaceDependencyVersion`).
 */
export function resolveWorkspaceDependencyRange(
  repoRoot: string,
  depName: WorkspaceToolingDependencyName
): string {
  let best: string | null = null;
  for (const pkgJsonPath of getWorkspacePackageJsonPaths(repoRoot)) {
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ] as const) {
      const deps = pkg[field];
      if (!deps || typeof deps !== "object" || Array.isArray(deps)) {
        continue;
      }
      const found = (deps as Record<string, string>)[depName];
      if (typeof found !== "string") {
        continue;
      }
      if (best == null || compareVersionSpecs(found, best) > 0) {
        best = found;
      }
    }
  }
  return best ?? FALLBACK_DEPENDENCY_VERSIONS[depName];
}
