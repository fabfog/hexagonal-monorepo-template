import { describe, expect, it } from "vitest";
import { UiPackageSlug } from "./ui-package-slug.vo";

describe("UiPackageSlug", () => {
  it("fromString normalizes to kebab-case and validates", () => {
    expect(UiPackageSlug.fromString("UserProfile").value).toBe("user-profile");
    expect(UiPackageSlug.fromString("  hello world  ").value).toBe("hello-world");
    expect(UiPackageSlug.fromString("already-kebab").value).toBe("already-kebab");
  });

  it("constructor accepts a valid slug string", () => {
    expect(new UiPackageSlug("foo-bar").value).toBe("foo-bar");
  });

  it("rejects invalid slug shapes after normalization", () => {
    expect(() => UiPackageSlug.fromString("")).toThrow();
    expect(() => UiPackageSlug.fromString("___")).toThrow();
    expect(() => new UiPackageSlug("Hello-World")).toThrow();
    expect(() => new UiPackageSlug("bad--hyphen")).toThrow();
  });

  it("equals compares by value", () => {
    const a = UiPackageSlug.fromString("MyThing");
    const b = UiPackageSlug.fromString("my-thing");
    expect(a.equals(b)).toBe(true);
  });
});
