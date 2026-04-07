import { kebabCase } from "case-anything";
import { z } from "zod";

/**
 * Lowercase alphanumeric segments separated by single hyphens (`src/entities/<slug>.entity.ts`).
 * Same shape as {@link DomainPackageSlug}; named distinctly for entity naming in the domain model.
 */
export const EntitySlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Invalid entity slug: use lowercase alphanumeric segments separated by single hyphens"
  );

export type EntitySlugInput = z.infer<typeof EntitySlugSchema>;

export class EntitySlug {
  private readonly _value: string;

  constructor(input: EntitySlugInput) {
    const parsed = EntitySlugSchema.parse(input);
    this._value = parsed;
  }

  /**
   * Normalizes with kebab-case (tooling-aligned), then validates as an entity slug.
   */
  static fromString(v: string): EntitySlug {
    const normalized = kebabCase(v);
    return new EntitySlug(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: EntitySlug): boolean {
    return other.value === this.value;
  }
}
