import { describe, expect, it } from "vitest";
import { Path } from "./path.vo";
import { Slug } from "./slug.vo";

describe("Path", () => {
  it("normalizes leading and trailing slashes and can be built from slugs", () => {
    const normalized = new Path("/blog/my-post/");
    const fromSlugs = Path.fromSlugs([new Slug("blog"), new Slug("my-post")]);

    expect(normalized.value).toBe("blog/my-post");
    expect(fromSlugs.value).toBe("blog/my-post");
    expect(normalized.equals(fromSlugs)).toBe(true);
  });

  it("rejects invalid path segments", () => {
    expect(() => new Path("Blog/My-Post")).toThrow();
    expect(() => new Path("blog//my-post")).toThrow();
  });
});
