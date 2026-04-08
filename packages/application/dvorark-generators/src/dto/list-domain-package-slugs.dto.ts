export interface ListDomainPackageSlugsInputDto {
  workspaceRoot: string;
  /** When omitted, default catalog behaviour applies (typically exclude `core`). */
  excludeCore?: boolean;
}
