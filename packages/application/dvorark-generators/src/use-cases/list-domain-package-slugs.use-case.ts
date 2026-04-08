import type { ListDomainPackageSlugsInputDto } from "../dto/list-domain-package-slugs.dto";
import type { DomainWorkspaceCatalogPort } from "../ports";

export interface ListDomainPackageSlugsUseCaseDependencies {
  domainWorkspaceCatalog: DomainWorkspaceCatalogPort;
}

export class ListDomainPackageSlugsUseCase {
  constructor(private readonly deps: ListDomainPackageSlugsUseCaseDependencies) {}

  async execute(input: ListDomainPackageSlugsInputDto): Promise<string[]> {
    if (input.excludeCore === undefined) {
      return this.deps.domainWorkspaceCatalog.listDomainPackageSlugs(input.workspaceRoot);
    }
    return this.deps.domainWorkspaceCatalog.listDomainPackageSlugs(input.workspaceRoot, {
      excludeCore: input.excludeCore,
    });
  }
}
