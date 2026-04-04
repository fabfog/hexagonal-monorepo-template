import { describe, expect, it } from "vitest";
import { Percentage } from "./percentage.vo";

describe("Percentage", () => {
  it("accepts boundary values and rejects out-of-range numbers", () => {
    expect(new Percentage(0).value).toBe(0);
    expect(new Percentage(100).value).toBe(100);
    expect(new Percentage(42).equals(new Percentage(42))).toBe(true);
    expect(() => new Percentage(-0.1)).toThrow();
    expect(() => new Percentage(100.1)).toThrow();
  });
});
