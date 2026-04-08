import type {
  TemplateRendererPort,
  WorkspaceFileToWrite,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import { UiPackageSlug } from "@domain/dvorark-generators/value-objects";
import type { CreateUiPackageInputDto } from "../dto/create-ui-package.dto";
import type { GeneratorBlueprintSourcePort, GeneratorToolingDefaultsPort } from "../ports";

/** Blueprint folder under `blueprints/generators/<id>/`. */
export const UI_PACKAGE_GENERATOR_ID = "ui-package" as const;

export interface CreateUiPackageUseCaseDependencies {
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  generatorBlueprintSource: GeneratorBlueprintSourcePort;
  generatorToolingDefaults: GeneratorToolingDefaultsPort;
}

export interface CreateUiPackageUseCaseReturn {
  filesWritten: number;
  packageSlug: string;
}

export class CreateUiPackageUseCase {
  constructor(private readonly deps: CreateUiPackageUseCaseDependencies) {}

  async execute(input: CreateUiPackageInputDto): Promise<CreateUiPackageUseCaseReturn> {
    const slug = UiPackageSlug.fromString(input.packageSlugInput);

    const vitestVersion =
      input.vitestVersionOverride ??
      (await this.deps.generatorToolingDefaults.vitestRange(input.workspaceRoot));

    const templateFiles = await this.deps.generatorBlueprintSource.load(UI_PACKAGE_GENERATOR_ID);
    const rendered: WorkspaceFileToWrite[] = [];

    for (const file of templateFiles) {
      const relativePath = `packages/ui/${slug.value}/${file.relativePath}`;
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
