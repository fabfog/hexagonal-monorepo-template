import { z } from "zod";

/** ISO 3166-1 alpha-2 country code (two uppercase letters, e.g. `"IT"`, `"US"`). */
export const CountryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, "Invalid country code: use ISO 3166-1 alpha-2 (e.g. IT, US)");

export type CountryCodeInput = z.infer<typeof CountryCodeSchema>;

export class CountryCode {
  private readonly _value: string;

  constructor(input: CountryCodeInput) {
    this._value = CountryCodeSchema.parse(input);
  }

  get value(): string {
    return this._value;
  }

  equals(other: CountryCode): boolean {
    return this._value === other._value;
  }
}
