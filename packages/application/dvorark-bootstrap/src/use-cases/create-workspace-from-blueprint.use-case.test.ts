import { describe, expect, it, vi } from "vitest";
import {
  CreateWorkspaceFromBlueprintUseCase,
  type CreateWorkspaceFromBlueprintUseCaseDependencies,
} from "./create-workspace-from-blueprint.use-case";

describe("CreateWorkspaceFromBlueprintUseCase", () => {
  it("renders and writes the starter blueprint", async () => {
    const deps: CreateWorkspaceFromBlueprintUseCaseDependencies = {
      workspaceTarget: {
        ensureReadyForCreate: vi.fn().mockResolvedValue(undefined),
      },
      blueprintSource: {
        readStarterBlueprint: vi.fn().mockResolvedValue([
          {
            relativePath: "README.md",
            kind: "template",
            contents: "## {{repoName}}",
          },
        ]),
      },
      templateRenderer: {
        render: vi.fn().mockResolvedValue("## my-repo"),
      },
      workspaceWriter: {
        writeFiles: vi.fn().mockResolvedValue(undefined),
      },
      workspaceInstall: {
        installDependencies: vi.fn().mockResolvedValue(undefined),
      },
    };

    const useCase = new CreateWorkspaceFromBlueprintUseCase(deps);
    const result = await useCase.execute({
      targetDirectory: "/tmp/my-repo",
      repoName: "my-repo",
    });

    expect(result.filesWritten).toBe(1);
    expect(deps.workspaceTarget.ensureReadyForCreate).toHaveBeenCalledWith("/tmp/my-repo");
    expect(deps.workspaceWriter.writeFiles).toHaveBeenCalledWith("/tmp/my-repo", [
      { relativePath: "README.md", contents: "## my-repo" },
    ]);
  });
});
