import { kebabCase } from "case-anything";
import { z } from "zod";

/**
 * Lowercase alphanumeric segments separated by single hyphens (`packages/application/<slug>`, `@application/<slug>`).
 */
export const ApplicationPackageSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Invalid application package slug: use lowercase alphanumeric segments separated by single hyphens"
  );

export type ApplicationPackageSlugInput = z.infer<typeof ApplicationPackageSlugSchema>;

export class ApplicationPackageSlug {
  private readonly _value: string;

  constructor(input: ApplicationPackageSlugInput) {
    const parsed = ApplicationPackageSlugSchema.parse(input);
    this._value = parsed;
  }

  /**
   * Normalizes with kebab-case (tooling-aligned), then validates as an application package slug.
   */
  static fromString(v: string): ApplicationPackageSlug {
    const normalized = kebabCase(v);
    return new ApplicationPackageSlug(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: ApplicationPackageSlug): boolean {
    return other.value === this.value;
  }
}
