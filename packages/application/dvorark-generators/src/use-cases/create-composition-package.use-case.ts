import type {
  TemplateRendererPort,
  WorkspaceFileToWrite,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import { pascalCase } from "case-anything";
import { CompositionPackageSlug } from "@domain/dvorark-generators/value-objects";
import type { CreateCompositionPackageInputDto } from "../dto/create-composition-package.dto";
import type { GeneratorBlueprintSourcePort } from "../ports";

/** Blueprint folder under `blueprints/generators/<id>/`. */
export const COMPOSITION_PACKAGE_GENERATOR_ID = "composition-package" as const;

export interface CreateCompositionPackageUseCaseDependencies {
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  generatorBlueprintSource: GeneratorBlueprintSourcePort;
}

export interface CreateCompositionPackageUseCaseReturn {
  filesWritten: number;
  packageSlug: string;
}

export class CreateCompositionPackageUseCase {
  constructor(private readonly deps: CreateCompositionPackageUseCaseDependencies) {}

  async execute(
    input: CreateCompositionPackageInputDto
  ): Promise<CreateCompositionPackageUseCaseReturn> {
    const slug = CompositionPackageSlug.fromString(input.packageSlugInput);
    const packageSlugPascal = pascalCase(slug.value);

    const templateFiles = await this.deps.generatorBlueprintSource.load(
      COMPOSITION_PACKAGE_GENERATOR_ID
    );
    const rendered: WorkspaceFileToWrite[] = [];

    for (const file of templateFiles) {
      const relativePath = `packages/composition/${slug.value}/${file.relativePath}`;
      const contents =
        file.kind === "template"
          ? await this.deps.templateRenderer.render(file.contents, {
              packageSlug: slug.value,
              packageSlugPascal,
            })
          : file.contents;

      rendered.push({ relativePath, contents });
    }

    await this.deps.workspaceWriter.writeFiles(input.workspaceRoot, rendered);

    return { filesWritten: rendered.length, packageSlug: slug.value };
  }
}
