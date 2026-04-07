/**
 * Driving input for {@link CreateDomainPackageUseCase} (strings from CLI / IPC).
 */
export interface CreateDomainPackageInputDto {
  /** Absolute path to the monorepo root where `packages/domain` lives. */
  workspaceRoot: string;
  /** User-typed name; normalized via {@link DomainPackageSlug.fromString}. */
  packageSlugInput: string;
  /** Optional override for the `vitest` range in generated `package.json`; otherwise resolved via `GeneratorToolingDefaultsPort`. */
  vitestVersionOverride?: string;
}
