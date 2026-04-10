import { describe, expect, it } from "vitest";
import { createPlopMorphProject, PLOP_MORPH_COMPILER_OPTIONS } from "./ts-morph-project.ts";

describe("createPlopMorphProject", () => {
  it("parses in-memory source with plop-aligned compiler options", () => {
    const project = createPlopMorphProject({ useInMemoryFileSystem: true });
    const source = `export const x = 1;\n`;
    const sf = project.createSourceFile("fixture.ts", source);
    expect(sf.getFullText()).toBe(source);
    expect(sf.getVariableDeclarations()).toHaveLength(1);
    expect(sf.getVariableDeclarations()[0]!.getName()).toBe("x");
  });

  it("exposes strict compiler defaults", () => {
    expect(PLOP_MORPH_COMPILER_OPTIONS.strict).toBe(true);
    expect(PLOP_MORPH_COMPILER_OPTIONS.noEmit).toBe(true);
    expect(PLOP_MORPH_COMPILER_OPTIONS.allowImportingTsExtensions).toBe(true);
  });
});
