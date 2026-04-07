import type { WorkspaceInspectionPort } from "@application/dvorark-bootstrap/ports";

export interface GetWorkspaceStatusUseCaseDependencies {
  workspaceInspection: WorkspaceInspectionPort;
}

export interface GetWorkspaceStatusUseCaseInput {
  targetDirectory: string;
}

export interface GetWorkspaceStatusUseCaseReturn {
  status: "missing" | "ready";
}

export class GetWorkspaceStatusUseCase {
  constructor(private readonly deps: GetWorkspaceStatusUseCaseDependencies) {}

  async execute(input: GetWorkspaceStatusUseCaseInput): Promise<GetWorkspaceStatusUseCaseReturn> {
    const hasWorkspaceMarker = await this.deps.workspaceInspection.hasWorkspaceMarker(
      input.targetDirectory
    );

    return {
      status: hasWorkspaceMarker ? "ready" : "missing",
    };
  }
}
