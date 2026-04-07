import { describe, expect, it } from "vitest";
import { EMPTY_BARREL_EXPORT_PATTERN } from "./constants";
import { mergeBarrelExport } from "./merge-barrel-export";

describe("mergeBarrelExport", () => {
  it("appends and dedupes", () => {
    expect(mergeBarrelExport(null, "export * from './a';")).toBe("export * from './a';\n");
    expect(
      mergeBarrelExport(
        "export * from './a';\n",
        "export * from './a';",
        EMPTY_BARREL_EXPORT_PATTERN
      )
    ).toBe("export * from './a';\n");
    expect(
      mergeBarrelExport("export {};\n", "export * from './x';", EMPTY_BARREL_EXPORT_PATTERN)
    ).toBe("export * from './x';\n");
  });
});
