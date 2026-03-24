import { describe, it, expect } from "vitest";
import DataLoader from "dataloader";
import { createDataLoaderRegistry } from "./index";

describe("createDataLoaderRegistry", () => {
  it("returns same loader instance for the same key", () => {
    const registry = createDataLoaderRegistry();
    const factory = () => new DataLoader<string, string>(async (ids) => ids.map((id) => id));

    const loader1 = registry.getOrCreate("test", factory);
    const loader2 = registry.getOrCreate("test", factory);

    expect(loader1).toBe(loader2);
  });

  it("returns different loader instances for different keys", () => {
    const registry = createDataLoaderRegistry();
    const factory = () => new DataLoader<string, string>(async (ids) => ids.map((id) => id));

    const loaderA = registry.getOrCreate("keyA", factory);
    const loaderB = registry.getOrCreate("keyB", factory);

    expect(loaderA).not.toBe(loaderB);
  });

  it("calls factory only once per key", () => {
    const registry = createDataLoaderRegistry();
    const factory = () => {
      callCount++;
      return new DataLoader<string, string>(async (ids) => ids.map((id) => id));
    };
    let callCount = 0;

    registry.getOrCreate("once", factory);
    registry.getOrCreate("once", factory);

    expect(callCount).toBe(1);
  });
});
