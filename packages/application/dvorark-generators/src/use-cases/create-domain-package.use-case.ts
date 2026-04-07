import type {
  TemplateRendererPort,
  WorkspaceFileToWrite,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import { DomainPackageSlug } from "@domain/dvorark-generators/value-objects";
import type { CreateDomainPackageInputDto } from "../dto/create-domain-package.dto";
import type { GeneratorBlueprintSourcePort, GeneratorToolingDefaultsPort } from "../ports";

/** Blueprint folder under `blueprints/generators/<id>/`. */
export const DOMAIN_PACKAGE_GENERATOR_ID = "domain-package" as const;

export interface CreateDomainPackageUseCaseDependencies {
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  generatorBlueprintSource: GeneratorBlueprintSourcePort;
  generatorToolingDefaults: GeneratorToolingDefaultsPort;
}

export interface CreateDomainPackageUseCaseReturn {
  filesWritten: number;
  packageSlug: string;
}

export class CreateDomainPackageUseCase {
  constructor(private readonly deps: CreateDomainPackageUseCaseDependencies) {}

  async execute(input: CreateDomainPackageInputDto): Promise<CreateDomainPackageUseCaseReturn> {
    const slug = DomainPackageSlug.fromString(input.packageSlugInput);

    const vitestVersion =
      input.vitestVersionOverride ??
      (await this.deps.generatorToolingDefaults.vitestRange(input.workspaceRoot));

    const templateFiles = await this.deps.generatorBlueprintSource.load(
      DOMAIN_PACKAGE_GENERATOR_ID
    );
    const rendered: WorkspaceFileToWrite[] = [];

    for (const file of templateFiles) {
      const relativePath = `packages/domain/${slug.value}/${file.relativePath}`;
      const contents =
        file.kind === "template"
          ? await this.deps.templateRenderer.render(file.contents, {
              packageSlug: slug.value,
              vitestVersion,
            })
          : file.contents;

      rendered.push({ relativePath, contents });
    }

    await this.deps.workspaceWriter.writeFiles(input.workspaceRoot, rendered);

    return { filesWritten: rendered.length, packageSlug: slug.value };
  }
}
