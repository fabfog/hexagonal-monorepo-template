import { describe, expect, it } from "vitest";
import { ValueObjectSlug } from "./value-object-slug.vo";

describe("ValueObjectSlug", () => {
  it("fromString normalizes to kebab-case and validates", () => {
    expect(ValueObjectSlug.fromString("UserId").value).toBe("user-id");
    expect(ValueObjectSlug.fromString("EmailAddress").value).toBe("email-address");
    expect(ValueObjectSlug.fromString("  order line  ").value).toBe("order-line");
  });

  it("constructor accepts a valid slug string", () => {
    expect(new ValueObjectSlug("foo-bar").value).toBe("foo-bar");
  });

  it("rejects invalid slug shapes after normalization", () => {
    expect(() => ValueObjectSlug.fromString("")).toThrow();
    expect(() => ValueObjectSlug.fromString("___")).toThrow();
    expect(() => new ValueObjectSlug("Hello-World")).toThrow();
    expect(() => new ValueObjectSlug("bad--hyphen")).toThrow();
  });

  it("equals compares by value", () => {
    const a = ValueObjectSlug.fromString("TicketId");
    const b = ValueObjectSlug.fromString("ticket-id");
    expect(a.equals(b)).toBe(true);
  });
});
