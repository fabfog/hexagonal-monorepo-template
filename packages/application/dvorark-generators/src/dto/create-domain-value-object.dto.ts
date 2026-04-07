/**
 * Driving input for {@link CreateDomainValueObjectUseCase} (strings from CLI / IPC).
 */
export type ValueObjectKind = "single-value" | "composite";

export type SingleValuePrimitive = "string" | "boolean" | "number" | "Date";

export interface CreateDomainValueObjectInputDto {
  /** Absolute path to the monorepo root where `packages/domain/<domainPackage>` exists. */
  workspaceRoot: string;
  /** Existing domain package segment under `packages/domain/`. */
  domainPackageSlugInput: string;
  /** Base name; normalized via `ValueObjectSlug.fromString` (file is `<slug>.vo.ts`). */
  valueObjectSlugInput: string;
  /** Single primitive wrapper vs composite object VO (Plop-aligned). */
  valueObjectKind: ValueObjectKind;
  /** Used when {@link valueObjectKind} is `single-value`; defaults to `string` in the use case. */
  singleValuePrimitive?: SingleValuePrimitive;
  /** Optional override for `zod` in patched domain `package.json`; otherwise `GeneratorToolingDefaultsPort.zodRange`. */
  zodVersionOverride?: string;
}
