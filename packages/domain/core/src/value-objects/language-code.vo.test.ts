import { describe, expect, it } from "vitest";
import { LanguageCode } from "./language-code.vo";

describe("LanguageCode", () => {
  it("accepts simple and regioned BCP 47 tags and rejects malformed ones", () => {
    expect(new LanguageCode("en").value).toBe("en");
    expect(new LanguageCode("pt-BR").value).toBe("pt-BR");
    expect(() => new LanguageCode("EN")).toThrow();
    expect(() => new LanguageCode("en-br")).toThrow();
  });
});
