import { describe, expect, it, vi } from "vitest";
import {
  CreateDomainServiceUseCase,
  DOMAIN_SERVICE_GENERATOR_ID,
} from "./create-domain-service.use-case";

describe("CreateDomainServiceUseCase", () => {
  it("writes service file, barrel, and patches package.json exports", async () => {
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
        if (rel.endsWith("user-discount.service.ts")) {
          return null;
        }
        if (rel.endsWith("package.json")) {
          return JSON.stringify({ name: "@domain/test", dependencies: {} }, null, 2);
        }
        if (rel.endsWith("services/index.ts")) {
          return null;
        }
        return null;
      }),
    };
    const generatorBlueprintSource = {
      load: vi.fn(async () => [
        {
          relativePath: "service.ts",
          kind: "template" as const,
          contents: "tpl",
        },
      ]),
    };

    const uc = new CreateDomainServiceUseCase({
      templateRenderer,
      workspaceWriter,
      workspaceReader,
      generatorBlueprintSource,
    });

    const out = await uc.execute({
      workspaceRoot: "/tmp/ws",
      domainPackageSlugInput: "fixture-codegen-entity",
      serviceNameInput: "UserDiscount",
      selectedEntityPascalNames: ["User"],
    });

    expect(out.serviceKebab).toBe("user-discount");
    expect(out.domainPackageSlug).toBe("fixture-codegen-entity");
    expect(out.filesWritten).toBe(3);
    expect(generatorBlueprintSource.load).toHaveBeenCalledWith(DOMAIN_SERVICE_GENERATOR_ID);

    expect(templateRenderer.render).toHaveBeenCalledWith(
      "tpl",
      expect.objectContaining({
        entityImportBlock: "  UserEntity,",
        servicePascal: "UserDiscount",
      })
    );

    expect(workspaceWriter.writeFiles).toHaveBeenCalledWith(
      "/tmp/ws",
      expect.arrayContaining([
        expect.objectContaining({
          relativePath:
            "packages/domain/fixture-codegen-entity/src/services/user-discount.service.ts",
        }),
        expect.objectContaining({
          relativePath: "packages/domain/fixture-codegen-entity/src/services/index.ts",
        }),
        expect.objectContaining({
          relativePath: "packages/domain/fixture-codegen-entity/package.json",
        }),
      ])
    );
  });
});
