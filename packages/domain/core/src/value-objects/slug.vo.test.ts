import { describe, expect, it } from "vitest";
import { Slug } from "./slug.vo";

describe("Slug", () => {
  it("accepts lowercase slug segments and rejects invalid shapes", () => {
    expect(new Slug("hello-world-2026").value).toBe("hello-world-2026");
    expect(new Slug("hello-world-2026").equals(new Slug("hello-world-2026"))).toBe(true);
    expect(() => new Slug("Hello-World")).toThrow();
    expect(() => new Slug("hello--world")).toThrow();
  });
});
