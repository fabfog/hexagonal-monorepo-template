import { describe, expect, it, vi } from "vitest";
import {
  COMPOSITION_PACKAGE_GENERATOR_ID,
  CreateCompositionPackageUseCase,
} from "./create-composition-package.use-case";

describe("CreateCompositionPackageUseCase", () => {
  it("maps DTO to slug, renders templates with slug + PascalCase, and writes files", async () => {
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

    const uc = new CreateCompositionPackageUseCase({
      templateRenderer,
      workspaceWriter,
      generatorBlueprintSource,
    });

    const out = await uc.execute({
      workspaceRoot: "/tmp/ws",
      packageSlugInput: "MyShell",
    });

    expect(out.packageSlug).toBe("my-shell");
    expect(out.filesWritten).toBe(1);
    expect(generatorBlueprintSource.load).toHaveBeenCalledWith(COMPOSITION_PACKAGE_GENERATOR_ID);
    expect(templateRenderer.render).toHaveBeenCalledWith(
      "tpl",
      expect.objectContaining({
        packageSlug: "my-shell",
        packageSlugPascal: "MyShell",
      })
    );
    expect(workspaceWriter.writeFiles).toHaveBeenCalledWith("/tmp/ws", [
      {
        relativePath: "packages/composition/my-shell/package.json",
        contents: expect.stringContaining("my-shell"),
      },
    ]);
  });
});
