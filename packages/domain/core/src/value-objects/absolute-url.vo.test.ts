import { describe, expect, it } from "vitest";
import { AbsoluteUrl } from "./absolute-url.vo";

describe("AbsoluteUrl", () => {
  it("accepts absolute URLs and rejects relative paths or urls without protocol", () => {
    expect(new AbsoluteUrl("https://example.com/docs").value).toBe("https://example.com/docs");
  });
  it("rejects relative paths and urls without protocol", () => {
    expect(() => new AbsoluteUrl("/docs")).toThrow();
    expect(() => new AbsoluteUrl("www.example.com/docs")).toThrow();
  });
});
