import type { TemplateRendererPort } from "@application/dvorark-bootstrap/ports";
import type { WorkspaceWriterPort } from "@application/dvorark-bootstrap/ports";
import type { GeneratorBlueprintSourcePort, GeneratorToolingDefaultsPort } from "../ports";
import { CreateDomainPackageUseCase } from "../use-cases/create-domain-package.use-case";

export interface DvorarkGeneratorsInfra {
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  generatorBlueprintSource: GeneratorBlueprintSourcePort;
  generatorToolingDefaults: GeneratorToolingDefaultsPort;
}

export class DvorarkGeneratorsModule {
  constructor(private readonly infra: DvorarkGeneratorsInfra) {}

  createDomainPackage(): CreateDomainPackageUseCase {
    return new CreateDomainPackageUseCase({
      templateRenderer: this.infra.templateRenderer,
      workspaceWriter: this.infra.workspaceWriter,
      generatorBlueprintSource: this.infra.generatorBlueprintSource,
      generatorToolingDefaults: this.infra.generatorToolingDefaults,
    });
  }
}
