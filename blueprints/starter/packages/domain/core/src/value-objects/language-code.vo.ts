import { z } from "zod";

/**
 * BCP 47 language code.
 * Accepts both simple subtags (`"en"`, `"it"`) and region subtags (`"en-US"`, `"pt-BR"`).
 */
export const LanguageCodeSchema = z
  .string()
  .regex(
    /^[a-z]{2,3}(?:-[A-Z]{2})?$/,
    "Invalid language code: use BCP 47 format (e.g. en, it, en-US)"
  );

export type LanguageCodeInput = z.infer<typeof LanguageCodeSchema>;

export class LanguageCode {
  private readonly _value: string;

  constructor(input: LanguageCodeInput) {
    this._value = LanguageCodeSchema.parse(input);
  }

  get value(): string {
    return this._value;
  }

  equals(other: LanguageCode): boolean {
    return this._value === other._value;
  }
}
