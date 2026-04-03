import { z } from "zod";
import { type Slug } from "./slug.vo";

/**
 * URL path stored without leading or trailing slashes.
 * Leading/trailing slashes in the input are stripped automatically so that
 * `"/home/"`, `"home/"`, and `"home"` all resolve to the same value `"home"`.
 * Examples of valid input: `"about"`, `"/blog/my-post"`, `"products/shoes/"`.
 */
export const PathSchema = z
  .string()
  .min(1)
  .transform((s) => s.replace(/^\/+|\/+$/g, ""))
  .pipe(
    z
      .string()
      .min(1)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
        "Invalid path: use slug segments (lowercase alphanumeric + hyphens) separated by slashes"
      )
  );

export type PathInput = z.infer<typeof PathSchema>;

export class Path {
  private readonly _value: string;

  constructor(input: PathInput) {
    this._value = PathSchema.parse(input);
  }

  /** Build a Path by joining an array of Slug values with `/`. */
  static fromSlugs(slugs: [Slug, ...Slug[]]): Path {
    return new Path(slugs.map((s) => s.value).join("/"));
  }

  get value(): string {
    return this._value;
  }

  equals(other: Path): boolean {
    return this._value === other._value;
  }
}
