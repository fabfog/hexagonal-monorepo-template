import { describe, expect, it } from "vitest";
import {
  patchPackageJsonEnsureZodDependency,
  patchPackageJsonExports,
  patchPackageJsonWithZodAndExports,
} from "./patch-package-json";

const SAMPLE_ZOD = "^3.23.8";

describe("patchPackageJsonExports", () => {
  it("ensures selected exports without zod", () => {
    const raw = JSON.stringify({ name: "@domain/t", dependencies: {} }, null, 2);
    const out = patchPackageJsonExports(raw, { exportSubpaths: ["services"] });
    const pkg = JSON.parse(out) as {
      dependencies?: Record<string, string>;
      exports: Record<string, string>;
    };
    expect(pkg.dependencies?.zod).toBeUndefined();
    expect(pkg.exports["./services"]).toBe("./src/services/index.ts");
  });

  it("can ensure multiple slices", () => {
    const raw = JSON.stringify({ name: "@domain/t", dependencies: {} }, null, 2);
    const out = patchPackageJsonExports(raw, {
      exportSubpaths: ["entities", "value-objects"],
    });
    const pkg = JSON.parse(out) as { exports: Record<string, string> };
    expect(pkg.exports["./entities"]).toBe("./src/entities/index.ts");
    expect(pkg.exports["./value-objects"]).toBe("./src/value-objects/index.ts");
  });
});

describe("patchPackageJsonEnsureZodDependency", () => {
  it("adds zod without touching exports shape when absent", () => {
    const raw = JSON.stringify({ name: "@domain/t", dependencies: {} }, null, 2);
    const out = patchPackageJsonEnsureZodDependency(raw, SAMPLE_ZOD);
    const pkg = JSON.parse(out) as { dependencies: { zod: string }; exports?: unknown };
    expect(pkg.dependencies.zod).toBe(SAMPLE_ZOD);
    expect(pkg.exports).toBeUndefined();
  });
});

describe("patchPackageJsonWithZodAndExports", () => {
  it("ensures zod and selected exports", () => {
    const raw = JSON.stringify({ name: "@domain/t", dependencies: {} }, null, 2);
    const out = patchPackageJsonWithZodAndExports(raw, {
      zodRange: SAMPLE_ZOD,
      exportSubpaths: ["value-objects"],
    });
    const pkg = JSON.parse(out) as {
      dependencies: { zod: string };
      exports: Record<string, string>;
    };
    expect(pkg.dependencies.zod).toBe(SAMPLE_ZOD);
    expect(pkg.exports["./value-objects"]).toBe("./src/value-objects/index.ts");
    expect(pkg.exports["./entities"]).toBeUndefined();
  });

  it("can ensure multiple slices with zod", () => {
    const raw = JSON.stringify({ name: "@domain/t", dependencies: {} }, null, 2);
    const out = patchPackageJsonWithZodAndExports(raw, {
      zodRange: SAMPLE_ZOD,
      exportSubpaths: ["entities", "value-objects"],
    });
    const pkg = JSON.parse(out) as {
      dependencies: { zod: string };
      exports: Record<string, string>;
    };
    expect(pkg.dependencies.zod).toBe(SAMPLE_ZOD);
    expect(pkg.exports["./entities"]).toBe("./src/entities/index.ts");
    expect(pkg.exports["./value-objects"]).toBe("./src/value-objects/index.ts");
  });
});
