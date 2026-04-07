import { CreateWorkspaceFromBlueprintUseCase } from "../use-cases/create-workspace-from-blueprint.use-case";
import { GetWorkspaceStatusUseCase } from "../use-cases/get-workspace-status.use-case";
import type {
  BlueprintSourcePort,
  WorkspaceInspectionPort,
  TemplateRendererPort,
  WorkspaceInstallPort,
  WorkspaceTargetPort,
  WorkspaceWriterPort,
} from "../ports";

export interface WorkspaceBootstrapInfra {
  blueprintSource: BlueprintSourcePort;
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  workspaceInstall: WorkspaceInstallPort;
  workspaceTarget: WorkspaceTargetPort;
  workspaceInspection: WorkspaceInspectionPort;
}

export class WorkspaceBootstrapModule {
  constructor(private readonly infra: WorkspaceBootstrapInfra) {}

  public createWorkspaceFromBlueprint(): CreateWorkspaceFromBlueprintUseCase {
    return new CreateWorkspaceFromBlueprintUseCase({
      blueprintSource: this.infra.blueprintSource,
      templateRenderer: this.infra.templateRenderer,
      workspaceWriter: this.infra.workspaceWriter,
      workspaceInstall: this.infra.workspaceInstall,
      workspaceTarget: this.infra.workspaceTarget,
    });
  }

  public getWorkspaceStatus(): GetWorkspaceStatusUseCase {
    return new GetWorkspaceStatusUseCase({
      workspaceInspection: this.infra.workspaceInspection,
    });
  }
}
