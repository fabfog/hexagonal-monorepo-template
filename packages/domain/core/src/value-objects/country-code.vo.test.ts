import { describe, expect, it } from "vitest";
import { CountryCode } from "./country-code.vo";

describe("CountryCode", () => {
  it("accepts ISO alpha-2 uppercase codes only", () => {
    expect(new CountryCode("IT").value).toBe("IT");
    expect(() => new CountryCode("it")).toThrow();
    expect(() => new CountryCode("ITA")).toThrow();
  });
});
