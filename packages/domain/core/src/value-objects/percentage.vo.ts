import { z } from "zod";

/** Percentage value in the range [0, 100] (inclusive). */
export const PercentageSchema = z.number().min(0).max(100);

export type PercentageInput = z.infer<typeof PercentageSchema>;

export class Percentage {
  private readonly _value: number;

  constructor(input: PercentageInput) {
    this._value = PercentageSchema.parse(input);
  }

  get value(): number {
    return this._value;
  }

  equals(other: Percentage): boolean {
    return this._value === other._value;
  }
}
