import { describe, expect, it } from "vitest";
import {
  domainPackageJsonRelativePath,
  domainPackageRootRelative,
  domainSliceIndexRelativePath,
} from "./paths";

describe("domain package paths", () => {
  it("match monorepo layout", () => {
    expect(domainPackageRootRelative("user")).toBe("packages/domain/user");
    expect(domainPackageJsonRelativePath("user")).toBe("packages/domain/user/package.json");
    expect(domainSliceIndexRelativePath("user", "entities")).toBe(
      "packages/domain/user/src/entities/index.ts"
    );
    expect(domainSliceIndexRelativePath("user", "errors")).toBe(
      "packages/domain/user/src/errors/index.ts"
    );
    expect(domainSliceIndexRelativePath("user", "services")).toBe(
      "packages/domain/user/src/services/index.ts"
    );
  });
});
