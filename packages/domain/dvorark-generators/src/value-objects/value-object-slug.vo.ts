import { kebabCase } from "case-anything";
import { z } from "zod";

/**
 * Lowercase alphanumeric segments separated by single hyphens (`<slug>.vo.ts` under value-objects).
 * Same shape as {@link EntitySlug}; named for value-object file naming in generators.
 */
export const ValueObjectSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Invalid value object slug: use lowercase alphanumeric segments separated by single hyphens"
  );

export type ValueObjectSlugInput = z.infer<typeof ValueObjectSlugSchema>;

export class ValueObjectSlug {
  private readonly _value: string;

  constructor(input: ValueObjectSlugInput) {
    const parsed = ValueObjectSlugSchema.parse(input);
    this._value = parsed;
  }

  /**
   * Normalizes with kebab-case (tooling-aligned), then validates as a value-object file slug.
   */
  static fromString(v: string): ValueObjectSlug {
    const normalized = kebabCase(v);
    return new ValueObjectSlug(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: ValueObjectSlug): boolean {
    return other.value === this.value;
  }
}
