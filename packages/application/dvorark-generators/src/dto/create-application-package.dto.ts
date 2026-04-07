/**
 * Driving input for {@link CreateApplicationPackageUseCase} (strings from CLI / IPC).
 */
export interface CreateApplicationPackageInputDto {
  /** Absolute path to the monorepo root where `packages/application` lives. */
  workspaceRoot: string;
  /** User-typed name; normalized with the same slug rules as domain packages (`DomainPackageSlug`). */
  packageSlugInput: string;
  /** Optional override for the `vitest` range in generated `package.json`; otherwise resolved via `GeneratorToolingDefaultsPort`. */
  vitestVersionOverride?: string;
}
