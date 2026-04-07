/**
 * Driving input for {@link CreateDomainErrorUseCase} (strings from CLI / IPC).
 */
export type DomainErrorKind = "not-found" | "custom";

export interface CreateDomainErrorInputDto {
  /** Absolute path to the monorepo root where `packages/domain/<domainPackage>` exists. */
  workspaceRoot: string;
  /** Existing domain package segment under `packages/domain/`. */
  domainPackageSlugInput: string;
  /** Plop-aligned: not-found (entity id in message) vs custom static template. */
  errorKind: DomainErrorKind;
  /**
   * Required when {@link errorKind} is `not-found`: PascalCase entity name (e.g. `User`).
   */
  entityPascalInput?: string;
  /**
   * Required when {@link errorKind} is `custom`: error name segment (e.g. `InvalidState`, `not found`).
   * File becomes `<kebab>.error.ts`; class `<Pascal>Error`.
   */
  customErrorNameInput?: string;
}
