import { kebabCase } from "case-anything";
import { z } from "zod";

/**
 * Lowercase alphanumeric segments separated by single hyphens (`packages/composition/<slug>`, `@composition/<slug>`).
 */
export const CompositionPackageSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Invalid composition package slug: use lowercase alphanumeric segments separated by single hyphens"
  );

export type CompositionPackageSlugInput = z.infer<typeof CompositionPackageSlugSchema>;

export class CompositionPackageSlug {
  private readonly _value: string;

  constructor(input: CompositionPackageSlugInput) {
    const parsed = CompositionPackageSlugSchema.parse(input);
    this._value = parsed;
  }

  /**
   * Normalizes with kebab-case (tooling-aligned), then validates as a composition package slug.
   */
  static fromString(v: string): CompositionPackageSlug {
    const normalized = kebabCase(v);
    return new CompositionPackageSlug(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: CompositionPackageSlug): boolean {
    return other.value === this.value;
  }
}
