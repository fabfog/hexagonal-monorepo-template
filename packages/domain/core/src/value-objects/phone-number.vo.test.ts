import { describe, expect, it } from "vitest";
import { PhoneNumber } from "./phone-number.vo";

describe("PhoneNumber", () => {
  it("accepts E.164 numbers and rejects local formats", () => {
    expect(new PhoneNumber("+39012345678").value).toBe("+39012345678");
    expect(new PhoneNumber("+39012345678").equals(new PhoneNumber("+39012345678"))).toBe(true);
    expect(() => new PhoneNumber("39012345678")).toThrow();
    expect(() => new PhoneNumber("+0123456789")).toThrow();
  });
});
