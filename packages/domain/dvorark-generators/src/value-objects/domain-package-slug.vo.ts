import { kebabCase } from "case-anything";
import { z } from "zod";

/**
 * Lowercase alphanumeric segments separated by single hyphens (`packages/domain/<slug>`, `@domain/<slug>`).
 */
export const DomainPackageSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Invalid domain package slug: use lowercase alphanumeric segments separated by single hyphens"
  );

export type DomainPackageSlugInput = z.infer<typeof DomainPackageSlugSchema>;

export class DomainPackageSlug {
  private readonly _value: string;

  constructor(input: DomainPackageSlugInput) {
    const parsed = DomainPackageSlugSchema.parse(input);
    this._value = parsed;
  }

  /**
   * Normalizes with kebab-case (tooling-aligned), then validates as a domain package slug.
   */
  static fromString(v: string): DomainPackageSlug {
    const normalized = kebabCase(v);
    return new DomainPackageSlug(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: DomainPackageSlug): boolean {
    return other.value === this.value;
  }
}
