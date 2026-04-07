import type { BlueprintSourcePort } from "@application/dvorark-bootstrap/ports";
import type { TemplateRendererPort } from "@application/dvorark-bootstrap/ports";
import type { WorkspaceWriterPort } from "@application/dvorark-bootstrap/ports";
import type { WorkspaceInstallPort } from "@application/dvorark-bootstrap/ports";
import type { WorkspaceTargetPort } from "@application/dvorark-bootstrap/ports";

export interface CreateWorkspaceFromBlueprintUseCaseDependencies {
  blueprintSource: BlueprintSourcePort;
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  workspaceInstall: WorkspaceInstallPort;
  workspaceTarget: WorkspaceTargetPort;
}

export interface CreateWorkspaceFromBlueprintUseCaseInput {
  targetDirectory: string;
  repoName: string;
  installDependencies?: boolean;
}

export interface CreateWorkspaceFromBlueprintUseCaseReturn {
  filesWritten: number;
}

export class CreateWorkspaceFromBlueprintUseCase {
  constructor(private readonly deps: CreateWorkspaceFromBlueprintUseCaseDependencies) {}

  async execute(
    input: CreateWorkspaceFromBlueprintUseCaseInput
  ): Promise<CreateWorkspaceFromBlueprintUseCaseReturn> {
    await this.deps.workspaceTarget.ensureReadyForCreate(input.targetDirectory);

    const sourceFiles = await this.deps.blueprintSource.readStarterBlueprint();

    const renderedFiles = await Promise.all(
      sourceFiles.map(async (file) => ({
        relativePath: file.relativePath,
        contents:
          file.kind === "template"
            ? await this.deps.templateRenderer.render(file.contents, {
                repoName: input.repoName,
              })
            : file.contents,
      }))
    );

    await this.deps.workspaceWriter.writeFiles(input.targetDirectory, renderedFiles);

    if (input.installDependencies) {
      await this.deps.workspaceInstall.installDependencies(input.targetDirectory);
    }

    return { filesWritten: renderedFiles.length };
  }
}
