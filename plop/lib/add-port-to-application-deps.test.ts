import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildAddPortDependencyToSliceActions,
  parseDependenciesInterface,
} from "./add-port-to-application-deps.ts";

const tmpDirs: string[] = [];

function mkTmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plop-add-port-"));
  tmpDirs.push(dir);
  return dir;
}

function writeFile(root: string, relPath: string, content: string) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0, tmpDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("parseDependenciesInterface", () => {
  it("extracts properties and insertion point from deps interface", () => {
    const source = `import type { APort } from "@application/a/ports";

export interface DemoUseCaseDependencies {
  aPort: APort;
}
`;
    const out = parseDependenciesInterface(source, "DemoUseCaseDependencies");
    expect(out.properties).toEqual([{ name: "aPort", type: "APort" }]);
    expect(out.indent).toBe("  ");
    expect(source.slice(out.closeIdx, out.closeIdx + 1)).toBe("}");
  });
});

describe("buildAddPortDependencyToSliceActions", () => {
  it("adds import + deps property for selected port", () => {
    const repoRoot = mkTmpRepo();
    writeFile(
      repoRoot,
      "packages/application/demo/src/use-cases/update-title.use-case.ts",
      `export interface UpdateTitleUseCaseDependencies {
}
`
    );
    writeFile(
      repoRoot,
      "packages/application/ports-source/src/ports/title.repository.port.ts",
      `export interface TitleRepositoryPort {}`
    );
    writeFile(
      repoRoot,
      "packages/application/demo/package.json",
      JSON.stringify({ name: "@application/demo", dependencies: {} }, null, 2)
    );

    const actions = buildAddPortDependencyToSliceActions(repoRoot, {
      packageName: "demo",
      sliceKind: "use-case",
      sliceName: "update-title",
      portApplicationPackage: "ports-source",
      portFileName: "title.repository.port.ts",
      portPropertyName: "titleRepository",
    });

    const modifyAction = actions[0];
    if (!modifyAction || modifyAction.type !== "modify" || !("transform" in modifyAction)) {
      throw new Error("Expected first action to be a modify action with transform.");
    }

    const initial = fs.readFileSync(
      path.join(repoRoot, "packages/application/demo/src/use-cases/update-title.use-case.ts"),
      "utf8"
    );
    const transformed = modifyAction.transform(initial);
    expect(transformed).toContain(
      'import type { TitleRepositoryPort } from "@application/ports-source/ports";'
    );
    expect(transformed).toContain("titleRepository: TitleRepositoryPort;");
  });
});
