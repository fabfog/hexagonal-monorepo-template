import type { RequestContext } from "./types.js";
import {
  BlueprintSourceAdapter,
  TemplateRendererAdapter,
  WorkspaceInspectionAdapter,
  WorkspaceInstallAdapter,
  WorkspaceTargetAdapter,
  WorkspaceWriterAdapter,
} from "@infrastructure/driven-dvorark-bootstrap";

class DvorarkStudioInfrastructureProvider {
  private readonly blueprintSource = new BlueprintSourceAdapter();
  private readonly templateRenderer = new TemplateRendererAdapter();
  private readonly workspaceWriter = new WorkspaceWriterAdapter();
  private readonly workspaceInstall = new WorkspaceInstallAdapter();
  private readonly workspaceTarget = new WorkspaceTargetAdapter();
  private readonly workspaceInspection = new WorkspaceInspectionAdapter();

  getForContext(_ctx: RequestContext) {
    return {
      blueprintSource: this.blueprintSource,
      templateRenderer: this.templateRenderer,
      workspaceWriter: this.workspaceWriter,
      workspaceInstall: this.workspaceInstall,
      workspaceTarget: this.workspaceTarget,
      workspaceInspection: this.workspaceInspection,
    };
  }
}

export const infrastructureProvider = new DvorarkStudioInfrastructureProvider();
