import type { ListVoFieldChoicesForEntityFieldInputDto } from "../dto/list-vo-field-choices-for-entity-field.dto";
import type { DomainWorkspaceCatalogPort, VoFieldChoice } from "../ports";

export interface ListVoFieldChoicesForEntityFieldUseCaseDependencies {
  domainWorkspaceCatalog: DomainWorkspaceCatalogPort;
}

export class ListVoFieldChoicesForEntityFieldUseCase {
  constructor(private readonly deps: ListVoFieldChoicesForEntityFieldUseCaseDependencies) {}

  async execute(input: ListVoFieldChoicesForEntityFieldInputDto): Promise<VoFieldChoice[]> {
    return this.deps.domainWorkspaceCatalog.listVoFieldChoices(
      input.workspaceRoot,
      input.entityDomainPackage
    );
  }
}
