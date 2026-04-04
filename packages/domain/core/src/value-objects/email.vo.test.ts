import { describe, expect, it } from "vitest";
import { Email } from "./email.vo";

describe("Email", () => {
  it("normalizes emails to lowercase and compares by normalized value", () => {
    const email = new Email("User.Name+tag@Example.COM");

    expect(email.value).toBe("user.name+tag@example.com");
    expect(email.equals(new Email("user.name+tag@example.com"))).toBe(true);
    expect(() => new Email("not-an-email")).toThrow();
    expect(() => new Email("not@an@email.com")).toThrow();
    expect(() => new Email("not.an@email")).toThrow();
  });
});
