import { describe, expect, it } from "vitest";
import { Size2D } from "./size-2d.vo";

describe("Size2D", () => {
  it("exposes dimensions, aspect ratio, snapshot, and equality", () => {
    const size = new Size2D({ width: 1920, height: 1080 });

    expect(size.width).toBe(1920);
    expect(size.height).toBe(1080);
    expect(size.aspectRatio).toBeCloseTo(16 / 9);
    expect(size.toSnapshot()).toEqual({ width: 1920, height: 1080 });
    expect(size.equals(new Size2D({ width: 1920, height: 1080 }))).toBe(true);
    expect(() => new Size2D({ width: 0, height: 1080 })).toThrow();
  });
});
