import { describe, expect, it } from "vitest";
import { patchPackageJsonWithZodAndExports } from "./patch-package-json";

describe("patchPackageJsonWithZodAndExports", () => {
  it("ensures zod and selected exports", () => {
    const raw = JSON.stringify({ name: "@domain/t", dependencies: {} }, null, 2);
    const out = patchPackageJsonWithZodAndExports(raw, { exportSubpaths: ["value-objects"] });
    const pkg = JSON.parse(out) as {
      dependencies: { zod: string };
      exports: Record<string, string>;
    };
    expect(pkg.dependencies.zod).toBeDefined();
    expect(pkg.exports["./value-objects"]).toBe("./src/value-objects/index.ts");
    expect(pkg.exports["./entities"]).toBeUndefined();
  });

  it("can ensure multiple slices", () => {
    const raw = JSON.stringify({ name: "@domain/t", dependencies: {} }, null, 2);
    const out = patchPackageJsonWithZodAndExports(raw, {
      exportSubpaths: ["entities", "value-objects"],
    });
    const pkg = JSON.parse(out) as { exports: Record<string, string> };
    expect(pkg.exports["./entities"]).toBe("./src/entities/index.ts");
    expect(pkg.exports["./value-objects"]).toBe("./src/value-objects/index.ts");
  });
});
