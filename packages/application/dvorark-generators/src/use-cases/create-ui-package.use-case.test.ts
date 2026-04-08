import { describe, expect, it, vi } from "vitest";
import { CreateUiPackageUseCase, UI_PACKAGE_GENERATOR_ID } from "./create-ui-package.use-case";

describe("CreateUiPackageUseCase", () => {
  it("maps DTO to slug, renders templates, and writes files", async () => {
    const templateRenderer = {
      render: vi.fn(async (_template: string, data: Record<string, string>) =>
        JSON.stringify(data)
      ),
    };
    const workspaceWriter = {
      writeFiles: vi.fn().mockResolvedValue(undefined),
    };
    const generatorBlueprintSource = {
      load: vi.fn(async () => [
        {
          relativePath: "package.json",
          kind: "template" as const,
          contents: "tpl",
        },
      ]),
    };
    const generatorToolingDefaults = {
      vitestRange: vi.fn(async () => "^4.1.0"),
      zodRange: vi.fn(async () => "^3.23.8"),
    };

    const uc = new CreateUiPackageUseCase({
      templateRenderer,
      workspaceWriter,
      generatorBlueprintSource,
      generatorToolingDefaults,
    });

    const out = await uc.execute({
      workspaceRoot: "/tmp/ws",
      packageSlugInput: "UserProfile",
    });

    expect(out.packageSlug).toBe("user-profile");
    expect(out.filesWritten).toBe(1);
    expect(generatorBlueprintSource.load).toHaveBeenCalledWith(UI_PACKAGE_GENERATOR_ID);
    expect(generatorToolingDefaults.vitestRange).toHaveBeenCalledWith("/tmp/ws");
    expect(templateRenderer.render).toHaveBeenCalledWith(
      "tpl",
      expect.objectContaining({ packageSlug: "user-profile", vitestVersion: "^4.1.0" })
    );
    expect(workspaceWriter.writeFiles).toHaveBeenCalledWith("/tmp/ws", [
      {
        relativePath: "packages/ui/user-profile/package.json",
        contents: expect.stringContaining("user-profile"),
      },
    ]);
  });

  it("uses vitestVersionOverride when provided", async () => {
    const templateRenderer = {
      render: vi.fn(
        async (_t: string, data: Record<string, string>): Promise<string> =>
          data.vitestVersion ?? ""
      ),
    };
    const generatorToolingDefaults = {
      vitestRange: vi.fn(async () => "SHOULD_NOT_USE"),
      zodRange: vi.fn(async () => "SHOULD_NOT_USE"),
    };

    const uc = new CreateUiPackageUseCase({
      templateRenderer,
      workspaceWriter: { writeFiles: vi.fn().mockResolvedValue(undefined) },
      generatorBlueprintSource: {
        load: vi.fn(async () => [
          { relativePath: "package.json", kind: "template" as const, contents: "x" },
        ]),
      },
      generatorToolingDefaults,
    });

    await uc.execute({
      workspaceRoot: "/w",
      packageSlugInput: "a",
      vitestVersionOverride: "^9.0.0",
    });

    expect(generatorToolingDefaults.vitestRange).not.toHaveBeenCalled();
    expect(templateRenderer.render).toHaveBeenCalledWith(
      "x",
      expect.objectContaining({ vitestVersion: "^9.0.0" })
    );
  });
});
