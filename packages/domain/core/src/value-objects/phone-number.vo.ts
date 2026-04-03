import { z } from "zod";

/**
 * International phone number in E.164 format: `+` followed by 7–15 digits.
 * Example: `"+39012345678"`.
 */
export const PhoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, "Invalid phone number: use E.164 format (e.g. +39012345678)");

export type PhoneNumberInput = z.infer<typeof PhoneNumberSchema>;

export class PhoneNumber {
  private readonly _value: string;

  constructor(input: PhoneNumberInput) {
    this._value = PhoneNumberSchema.parse(input);
  }

  get value(): string {
    return this._value;
  }

  equals(other: PhoneNumber): boolean {
    return this._value === other._value;
  }
}
