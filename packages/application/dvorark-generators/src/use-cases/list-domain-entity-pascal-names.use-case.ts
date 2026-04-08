import type { ListDomainEntityPascalNamesInputDto } from "../dto/list-domain-entity-pascal-names.dto";
import type { DomainWorkspaceCatalogPort } from "../ports";

export interface ListDomainEntityPascalNamesUseCaseDependencies {
  domainWorkspaceCatalog: DomainWorkspaceCatalogPort;
}

export class ListDomainEntityPascalNamesUseCase {
  constructor(private readonly deps: ListDomainEntityPascalNamesUseCaseDependencies) {}

  async execute(input: ListDomainEntityPascalNamesInputDto): Promise<string[]> {
    return this.deps.domainWorkspaceCatalog.listDomainEntityPascalNames(
      input.workspaceRoot,
      input.domainPackageSlug
    );
  }
}
