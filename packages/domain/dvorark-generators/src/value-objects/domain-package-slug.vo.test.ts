import { describe, expect, it } from "vitest";
import { DomainPackageSlug } from "./domain-package-slug.vo";

describe("DomainPackageSlug", () => {
  it("fromString normalizes to kebab-case and validates", () => {
    expect(DomainPackageSlug.fromString("UserProfile").value).toBe("user-profile");
    expect(DomainPackageSlug.fromString("  hello world  ").value).toBe("hello-world");
    expect(DomainPackageSlug.fromString("already-kebab").value).toBe("already-kebab");
  });

  it("constructor accepts a valid slug string", () => {
    expect(new DomainPackageSlug("foo-bar").value).toBe("foo-bar");
  });

  it("rejects invalid slug shapes after normalization", () => {
    expect(() => DomainPackageSlug.fromString("")).toThrow();
    expect(() => DomainPackageSlug.fromString("___")).toThrow();
    expect(() => new DomainPackageSlug("Hello-World")).toThrow();
    expect(() => new DomainPackageSlug("bad--hyphen")).toThrow();
  });

  it("equals compares by value", () => {
    const a = DomainPackageSlug.fromString("MyThing");
    const b = DomainPackageSlug.fromString("my-thing");
    expect(a.equals(b)).toBe(true);
  });
});
