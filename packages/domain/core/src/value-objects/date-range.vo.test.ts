import { describe, expect, it } from "vitest";
import { DateRange } from "./date-range.vo";

describe("DateRange", () => {
  it("computes duration, checks inclusive containment, and equality", () => {
    const start = new Date("2026-01-01T10:00:00.000Z");
    const end = new Date("2026-01-01T12:30:00.000Z");
    const range = new DateRange({ start, end });

    expect(range.durationMs).toBe(9_000_000);
    expect(range.contains(start)).toBe(true);
    expect(range.contains(end)).toBe(true);
    expect(range.contains(new Date("2026-01-01T12:30:00.001Z"))).toBe(false);
    expect(range.equals(new DateRange({ start: new Date(start), end: new Date(end) }))).toBe(true);
    expect(range.toSnapshot()).toEqual({ start, end });
  });

  it("rejects ranges whose start is after the end", () => {
    expect(
      () =>
        new DateRange({
          start: new Date("2026-01-02T00:00:00.000Z"),
          end: new Date("2026-01-01T00:00:00.000Z"),
        })
    ).toThrow("DateRange start must be before or equal to end");
  });
});
