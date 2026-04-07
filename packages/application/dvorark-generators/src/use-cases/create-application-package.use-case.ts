import type {
  TemplateRendererPort,
  WorkspaceFileToWrite,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import { DomainPackageSlug } from "@domain/dvorark-generators/value-objects";
import type { CreateApplicationPackageInputDto } from "../dto/create-application-package.dto";
import type { GeneratorBlueprintSourcePort, GeneratorToolingDefaultsPort } from "../ports";

/** Blueprint folder under `blueprints/generators/<id>/`. */
export const APPLICATION_PACKAGE_GENERATOR_ID = "application-package" as const;

export interface CreateApplicationPackageUseCaseDependencies {
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  generatorBlueprintSource: GeneratorBlueprintSourcePort;
  generatorToolingDefaults: GeneratorToolingDefaultsPort;
}

export interface CreateApplicationPackageUseCaseReturn {
  filesWritten: number;
  packageSlug: string;
}

export class CreateApplicationPackageUseCase {
  constructor(private readonly deps: CreateApplicationPackageUseCaseDependencies) {}

  async execute(
    input: CreateApplicationPackageInputDto
  ): Promise<CreateApplicationPackageUseCaseReturn> {
    const slug = DomainPackageSlug.fromString(input.packageSlugInput);

    const vitestVersion =
      input.vitestVersionOverride ??
      (await this.deps.generatorToolingDefaults.vitestRange(input.workspaceRoot));

    const templateFiles = await this.deps.generatorBlueprintSource.load(
      APPLICATION_PACKAGE_GENERATOR_ID
    );
    const rendered: WorkspaceFileToWrite[] = [];

    for (const file of templateFiles) {
      const relativePath = `packages/application/${slug.value}/${file.relativePath}`;
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
