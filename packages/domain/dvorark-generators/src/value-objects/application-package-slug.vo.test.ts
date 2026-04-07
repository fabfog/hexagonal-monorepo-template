import { describe, expect, it } from "vitest";
import { ApplicationPackageSlug } from "./application-package-slug.vo";

describe("ApplicationPackageSlug", () => {
  it("fromString normalizes to kebab-case and validates", () => {
    expect(ApplicationPackageSlug.fromString("UserProfile").value).toBe("user-profile");
    expect(ApplicationPackageSlug.fromString("  hello world  ").value).toBe("hello-world");
    expect(ApplicationPackageSlug.fromString("already-kebab").value).toBe("already-kebab");
  });

  it("constructor accepts a valid slug string", () => {
    expect(new ApplicationPackageSlug("foo-bar").value).toBe("foo-bar");
  });

  it("rejects invalid slug shapes after normalization", () => {
    expect(() => ApplicationPackageSlug.fromString("")).toThrow();
    expect(() => ApplicationPackageSlug.fromString("___")).toThrow();
    expect(() => new ApplicationPackageSlug("Hello-World")).toThrow();
    expect(() => new ApplicationPackageSlug("bad--hyphen")).toThrow();
  });

  it("equals compares by value", () => {
    const a = ApplicationPackageSlug.fromString("MyThing");
    const b = ApplicationPackageSlug.fromString("my-thing");
    expect(a.equals(b)).toBe(true);
  });
});
