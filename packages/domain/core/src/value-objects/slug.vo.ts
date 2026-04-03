import { z } from "zod";

/** Lowercase alphanumeric segments separated by single hyphens. */
export const SlugSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Invalid slug: use lowercase alphanumeric segments separated by hyphens"
  );

export type SlugInput = z.infer<typeof SlugSchema>;

export class Slug {
  private readonly _value: string;

  constructor(input: SlugInput) {
    this._value = SlugSchema.parse(input);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Slug): boolean {
    return this._value === other._value;
  }
}
