import { kebabCase } from "case-anything";
import { z } from "zod";

/**
 * Lowercase alphanumeric segments separated by single hyphens (`packages/ui/<slug>`, `@ui/<slug>`).
 */
export const UiPackageSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Invalid UI package slug: use lowercase alphanumeric segments separated by single hyphens"
  );

export type UiPackageSlugInput = z.infer<typeof UiPackageSlugSchema>;

export class UiPackageSlug {
  private readonly _value: string;

  constructor(input: UiPackageSlugInput) {
    const parsed = UiPackageSlugSchema.parse(input);
    this._value = parsed;
  }

  /**
   * Normalizes with kebab-case (tooling-aligned), then validates as a UI package slug.
   */
  static fromString(v: string): UiPackageSlug {
    const normalized = kebabCase(v);
    return new UiPackageSlug(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: UiPackageSlug): boolean {
    return other.value === this.value;
  }
}
