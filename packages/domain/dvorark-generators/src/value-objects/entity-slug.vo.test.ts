import { describe, expect, it } from "vitest";
import { EntitySlug } from "./entity-slug.vo";

describe("EntitySlug", () => {
  it("fromString normalizes to kebab-case and validates", () => {
    expect(EntitySlug.fromString("UserProfile").value).toBe("user-profile");
    expect(EntitySlug.fromString("  order line  ").value).toBe("order-line");
    expect(EntitySlug.fromString("ticket").value).toBe("ticket");
  });

  it("constructor accepts a valid slug string", () => {
    expect(new EntitySlug("foo-bar").value).toBe("foo-bar");
  });

  it("rejects invalid slug shapes after normalization", () => {
    expect(() => EntitySlug.fromString("")).toThrow();
    expect(() => EntitySlug.fromString("___")).toThrow();
    expect(() => new EntitySlug("Hello-World")).toThrow();
    expect(() => new EntitySlug("bad--hyphen")).toThrow();
  });

  it("equals compares by value", () => {
    const a = EntitySlug.fromString("MyThing");
    const b = EntitySlug.fromString("my-thing");
    expect(a.equals(b)).toBe(true);
  });
});
