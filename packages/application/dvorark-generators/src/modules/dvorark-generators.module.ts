import type {
  TemplateRendererPort,
  WorkspaceReaderPort,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import type { GeneratorBlueprintSourcePort, GeneratorToolingDefaultsPort } from "../ports";
import { CreateApplicationPackageUseCase } from "../use-cases/create-application-package.use-case";
import { CreateDomainEntityUseCase } from "../use-cases/create-domain-entity.use-case";
import { CreateDomainErrorUseCase } from "../use-cases/create-domain-error.use-case";
import { CreateDomainServiceUseCase } from "../use-cases/create-domain-service.use-case";
import { CreateDomainPackageUseCase } from "../use-cases/create-domain-package.use-case";
import { CreateDomainValueObjectUseCase } from "../use-cases/create-domain-value-object.use-case";

export interface DvorarkGeneratorsInfra {
  templateRenderer: TemplateRendererPort;
  workspaceReader: WorkspaceReaderPort;
  workspaceWriter: WorkspaceWriterPort;
  generatorBlueprintSource: GeneratorBlueprintSourcePort;
  generatorToolingDefaults: GeneratorToolingDefaultsPort;
}

export class DvorarkGeneratorsModule {
  constructor(private readonly infra: DvorarkGeneratorsInfra) {}

  createApplicationPackage(): CreateApplicationPackageUseCase {
    return new CreateApplicationPackageUseCase({
      templateRenderer: this.infra.templateRenderer,
      workspaceWriter: this.infra.workspaceWriter,
      generatorBlueprintSource: this.infra.generatorBlueprintSource,
      generatorToolingDefaults: this.infra.generatorToolingDefaults,
    });
  }

  createDomainPackage(): CreateDomainPackageUseCase {
    return new CreateDomainPackageUseCase({
      templateRenderer: this.infra.templateRenderer,
      workspaceWriter: this.infra.workspaceWriter,
      generatorBlueprintSource: this.infra.generatorBlueprintSource,
      generatorToolingDefaults: this.infra.generatorToolingDefaults,
    });
  }

  createDomainEntity(): CreateDomainEntityUseCase {
    return new CreateDomainEntityUseCase({
      templateRenderer: this.infra.templateRenderer,
      workspaceReader: this.infra.workspaceReader,
      workspaceWriter: this.infra.workspaceWriter,
      generatorBlueprintSource: this.infra.generatorBlueprintSource,
    });
  }

  createDomainError(): CreateDomainErrorUseCase {
    return new CreateDomainErrorUseCase({
      templateRenderer: this.infra.templateRenderer,
      workspaceReader: this.infra.workspaceReader,
      workspaceWriter: this.infra.workspaceWriter,
      generatorBlueprintSource: this.infra.generatorBlueprintSource,
    });
  }

  createDomainService(): CreateDomainServiceUseCase {
    return new CreateDomainServiceUseCase({
      templateRenderer: this.infra.templateRenderer,
      workspaceReader: this.infra.workspaceReader,
      workspaceWriter: this.infra.workspaceWriter,
      generatorBlueprintSource: this.infra.generatorBlueprintSource,
    });
  }

  createDomainValueObject(): CreateDomainValueObjectUseCase {
    return new CreateDomainValueObjectUseCase({
      templateRenderer: this.infra.templateRenderer,
      workspaceReader: this.infra.workspaceReader,
      workspaceWriter: this.infra.workspaceWriter,
      generatorBlueprintSource: this.infra.generatorBlueprintSource,
    });
  }
}
