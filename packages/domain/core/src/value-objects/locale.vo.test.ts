import { describe, expect, it } from "vitest";
import { CountryCode } from "./country-code.vo";
import { LanguageCode } from "./language-code.vo";
import { Locale } from "./locale.vo";

describe("Locale", () => {
  it("builds a locale from country/language objects and round-trips them", () => {
    const locale = Locale.fromCountryLanguage(new CountryCode("IT"), new LanguageCode("it"));
    const snapshot = locale.toSnapshot();
    const parts = locale.toCountryLanguage();

    expect(locale.code).toBe("it-IT");
    expect(snapshot).toEqual({ country: "IT", language: "it" });
    expect(parts.country.value).toBe("IT");
    expect(parts.language.value).toBe("it");
    expect(locale.equals(new Locale({ country: "IT", language: "it" }))).toBe(true);
  });
});
