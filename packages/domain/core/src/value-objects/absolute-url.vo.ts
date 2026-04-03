import { z } from "zod";

export const AbsoluteUrlSchema = z.string().url();

export type AbsoluteUrlInput = z.infer<typeof AbsoluteUrlSchema>;

export class AbsoluteUrl {
  private readonly _value: string;

  constructor(input: AbsoluteUrlInput) {
    this._value = AbsoluteUrlSchema.parse(input);
  }

  get value(): string {
    return this._value;
  }

  equals(other: AbsoluteUrl): boolean {
    return this._value === other._value;
  }
}
