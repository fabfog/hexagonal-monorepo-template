import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  FALLBACK_DEPENDENCY_VERSIONS,
  resolveWorkspaceDependencyRange,
} from "./resolve-workspace-dependency-range";

describe("resolveWorkspaceDependencyRange", () => {
  it("returns fallback when workspace has no package.json entries for the dep", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "dvorark-ws-"));
    expect(resolveWorkspaceDependencyRange(empty, "zod")).toBe(FALLBACK_DEPENDENCY_VERSIONS.zod);
    expect(resolveWorkspaceDependencyRange(empty, "vitest")).toBe(
      FALLBACK_DEPENDENCY_VERSIONS.vitest
    );
    fs.rmSync(empty, { recursive: true });
  });

  it("prefers highest semver-like range found across workspace package.json files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvorark-ws-"));
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { zod: "^3.22.0" } }),
      "utf8"
    );
    const pkgDir = path.join(root, "packages", "domain", "x");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({ dependencies: { zod: "^3.25.0" } }),
      "utf8"
    );

    expect(resolveWorkspaceDependencyRange(root, "zod")).toBe("^3.25.0");
    fs.rmSync(root, { recursive: true });
  });
});
