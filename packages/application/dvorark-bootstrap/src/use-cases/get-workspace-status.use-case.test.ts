import { describe, expect, it, vi } from "vitest";
import {
  GetWorkspaceStatusUseCase,
  type GetWorkspaceStatusUseCaseDependencies,
} from "./get-workspace-status.use-case";

describe("GetWorkspaceStatusUseCase", () => {
  it("returns ready when the workspace marker exists", async () => {
    const deps: GetWorkspaceStatusUseCaseDependencies = {
      workspaceInspection: {
        hasWorkspaceMarker: vi.fn().mockResolvedValue(true),
      },
    };

    const useCase = new GetWorkspaceStatusUseCase(deps);
    const result = await useCase.execute({
      targetDirectory: "/tmp/my-repo",
    });

    expect(result).toEqual({ status: "ready" });
    expect(deps.workspaceInspection.hasWorkspaceMarker).toHaveBeenCalledWith("/tmp/my-repo");
  });

  it("returns missing when the workspace marker does not exist", async () => {
    const deps: GetWorkspaceStatusUseCaseDependencies = {
      workspaceInspection: {
        hasWorkspaceMarker: vi.fn().mockResolvedValue(false),
      },
    };

    const useCase = new GetWorkspaceStatusUseCase(deps);
    const result = await useCase.execute({
      targetDirectory: "/tmp/my-repo",
    });

    expect(result).toEqual({ status: "missing" });
  });
});
