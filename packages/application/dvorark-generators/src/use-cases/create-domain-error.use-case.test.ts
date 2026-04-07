import { describe, expect, it, vi } from "vitest";
import {
  CreateDomainErrorUseCase,
  DOMAIN_ERROR_GENERATOR_ID,
} from "./create-domain-error.use-case";

describe("CreateDomainErrorUseCase", () => {
  it("writes not-found error and errors barrel", async () => {
    const templateRenderer = {
      render: vi.fn(async (_template: string, data: Record<string, string>) =>
        JSON.stringify(data)
      ),
    };
    const workspaceWriter = {
      writeFiles: vi.fn().mockResolvedValue(undefined),
    };
    const workspaceReader = {
      readTextIfExists: vi.fn(async (_root: string, rel: string) => {
        if (rel.endsWith("user-not-found.error.ts")) {
          return null;
        }
        if (rel.endsWith("errors/index.ts")) {
          return null;
        }
        return null;
      }),
    };
    const generatorBlueprintSource = {
      load: vi.fn(async () => [
        {
          relativePath: "entity-not-found.error.ts",
          kind: "template" as const,
          contents: "nf-tpl",
        },
        {
          relativePath: "custom.error.ts",
          kind: "template" as const,
          contents: "custom-tpl",
        },
      ]),
    };

    const uc = new CreateDomainErrorUseCase({
      templateRenderer,
      workspaceWriter,
      workspaceReader,
      generatorBlueprintSource,
    });

    const out = await uc.execute({
      workspaceRoot: "/tmp/ws",
      domainPackageSlugInput: "fixture-codegen-entity",
      errorKind: "not-found",
      entityPascalInput: "User",
    });

    expect(out.errorFileKebab).toBe("user-not-found");
    expect(out.errorKind).toBe("not-found");
    expect(out.filesWritten).toBe(2);
    expect(generatorBlueprintSource.load).toHaveBeenCalledWith(DOMAIN_ERROR_GENERATOR_ID);

    expect(workspaceWriter.writeFiles).toHaveBeenCalledWith(
      "/tmp/ws",
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "packages/domain/fixture-codegen-entity/src/errors/user-not-found.error.ts",
        }),
        expect.objectContaining({
          relativePath: "packages/domain/fixture-codegen-entity/src/errors/index.ts",
        }),
      ])
    );
  });

  it("writes custom error", async () => {
    const templateRenderer = {
      render: vi.fn(async (_template: string, data: Record<string, string>) =>
        JSON.stringify(data)
      ),
    };
    const workspaceWriter = {
      writeFiles: vi.fn().mockResolvedValue(undefined),
    };
    const workspaceReader = {
      readTextIfExists: vi.fn(async () => null),
    };
    const generatorBlueprintSource = {
      load: vi.fn(async () => [
        {
          relativePath: "entity-not-found.error.ts",
          kind: "template" as const,
          contents: "nf-tpl",
        },
        {
          relativePath: "custom.error.ts",
          kind: "template" as const,
          contents: "custom-tpl",
        },
      ]),
    };

    const uc = new CreateDomainErrorUseCase({
      templateRenderer,
      workspaceWriter,
      workspaceReader,
      generatorBlueprintSource,
    });

    const out = await uc.execute({
      workspaceRoot: "/tmp/ws",
      domainPackageSlugInput: "fixture-codegen-entity",
      errorKind: "custom",
      customErrorNameInput: "InvalidState",
    });

    expect(out.errorFileKebab).toBe("invalid-state");
    expect(templateRenderer.render).toHaveBeenCalledWith(
      "custom-tpl",
      expect.objectContaining({
        errorClassName: "InvalidStateError",
      })
    );
  });
});
