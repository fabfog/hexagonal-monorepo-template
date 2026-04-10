import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findImportModuleForIdentifier,
  scanPortImplementations,
} from "./scan-infrastructure-port-implementations.ts";
import { createPlopMorphProject } from "./ts-morph-project.ts";

const tmpDirs: string[] = [];

function mkTmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plop-scan-ports-"));
  tmpDirs.push(dir);
  return dir;
}

function writeFile(relPath: string, content: string, root: string) {
  const absPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, "utf8");
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0, tmpDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("scanPortImplementations", () => {
  it("finds exported classes implementing *Port with constructor arity", () => {
    const repoRoot = mkTmpRepo();
    writeFile(
      "packages/infrastructure/driven-foo/package.json",
      JSON.stringify({ name: "@infrastructure/driven-foo" }, null, 2),
      repoRoot
    );
    writeFile(
      "packages/infrastructure/driven-foo/src/repositories/foo.repository.ts",
      `import type { FooPort } from "@application/foo/ports";
export class FooRepository implements FooPort {
  constructor(private readonly dep: string, _opt?: number) {}
}`,
      repoRoot
    );
    writeFile(
      "packages/infrastructure/driven-foo/src/repositories/ignored.test.ts",
      "export class IgnoredTest implements FooPort {}",
      repoRoot
    );

    const out = scanPortImplementations(repoRoot, "driven-foo");

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      className: "FooRepository",
      portInterfaceName: "FooPort",
      infraFolder: "driven-foo",
      npmPackageName: "@infrastructure/driven-foo",
      relativePath: "repositories/foo.repository.ts",
      requiredConstructorParams: 1,
    });
  });
});

describe("findImportModuleForIdentifier", () => {
  it("returns module and type-only info for named imports", () => {
    const project = createPlopMorphProject({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile(
      "x.ts",
      `import type { FooPort } from "@application/foo/ports";`
    );
    expect(findImportModuleForIdentifier(sf, "FooPort")).toEqual({
      moduleSpecifier: "@application/foo/ports",
      isTypeOnly: true,
    });
  });
});
