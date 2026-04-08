/**
 * Read-only discovery of domain packages / entities / value objects on the monorepo filesystem.
 * Implemented by a driven adapter; consumed by generator use cases and interactive CLI.
 */

export interface ListDomainPackageSlugsOptions {
  /**
   * When `true` (default), omits `core` from the list.
   * Set `false` to include all domain packages (e.g. value-object generator).
   */
  excludeCore?: boolean;
}

export interface VoFieldChoiceValue {
  voClass: string;
  source: "core" | "local";
}

export interface VoFieldChoice {
  label: string;
  value: VoFieldChoiceValue;
}

export interface DomainWorkspaceCatalogPort {
  listDomainPackageSlugs(
    workspaceRoot: string,
    options?: ListDomainPackageSlugsOptions
  ): Promise<string[]>;

  listDomainEntityPascalNames(workspaceRoot: string, domainPackageSlug: string): Promise<string[]>;

  /**
   * VOs from the feature package (local) plus `@domain/core`, de-duplicated by class name (local wins).
   */
  listVoFieldChoices(workspaceRoot: string, entityDomainPackage: string): Promise<VoFieldChoice[]>;
}
