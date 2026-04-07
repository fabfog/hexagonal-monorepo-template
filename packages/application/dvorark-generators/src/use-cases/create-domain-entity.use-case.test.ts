import { describe, expect, it, vi } from "vitest";
import {
  CreateDomainEntityUseCase,
  DOMAIN_ENTITY_GENERATOR_ID,
} from "./create-domain-entity.use-case";

describe("CreateDomainEntityUseCase", () => {
  it("writes VO, entity, test, barrels, and patches domain package.json", async () => {
    const templateRenderer = {
      render: vi.fn(async (_template: string, data: Record<string, string>) =>
        JSON.stringify(data)
      ),
    };
    const workspaceWriter = {
      writeFiles: vi.fn().mockResolvedValue(undefined),
    };
    const workspaceReader = {
      readTextIfExists: vi.fn(async (root: string, rel: string) => {
        if (rel.endsWith("package.json")) {
          return JSON.stringify({ name: "@domain/test", dependencies: {} }, null, 2);
        }
        if (rel.endsWith("entities/index.ts")) {
          return "export {};\n";
        }
        if (rel.endsWith("value-objects/index.ts")) {
          return null;
        }
        return null;
      }),
    };
    const generatorBlueprintSource = {
      load: vi.fn(async () => [
        {
          relativePath: "entity-id.vo.ts",
          kind: "template" as const,
          contents: "vo-tpl",
        },
        {
          relativePath: "entity.entity.test.ts",
          kind: "template" as const,
          contents: "test-tpl",
        },
        {
          relativePath: "entity.entity.ts",
          kind: "template" as const,
          contents: "entity-tpl",
        },
      ]),
    };

    const uc = new CreateDomainEntityUseCase({
      templateRenderer,
      workspaceWriter,
      workspaceReader,
      generatorBlueprintSource,
    });

    const out = await uc.execute({
      workspaceRoot: "/tmp/ws",
      domainPackageSlugInput: "fixture-codegen-entity",
      entitySlugInput: "LineItem",
    });

    expect(out.entitySlug).toBe("line-item");
    expect(out.domainPackageSlug).toBe("fixture-codegen-entity");
    expect(out.filesWritten).toBe(6);
    expect(generatorBlueprintSource.load).toHaveBeenCalledWith(DOMAIN_ENTITY_GENERATOR_ID);

    expect(workspaceWriter.writeFiles).toHaveBeenCalledWith(
      "/tmp/ws",
      expect.arrayContaining([
        expect.objectContaining({
          relativePath:
            "packages/domain/fixture-codegen-entity/src/value-objects/line-item-id.vo.ts",
        }),
        expect.objectContaining({
          relativePath: "packages/domain/fixture-codegen-entity/src/entities/line-item.entity.ts",
        }),
        expect.objectContaining({
          relativePath:
            "packages/domain/fixture-codegen-entity/src/entities/line-item.entity.test.ts",
        }),
        expect.objectContaining({
          relativePath: "packages/domain/fixture-codegen-entity/src/entities/index.ts",
        }),
        expect.objectContaining({
          relativePath: "packages/domain/fixture-codegen-entity/src/value-objects/index.ts",
        }),
        expect.objectContaining({
          relativePath: "packages/domain/fixture-codegen-entity/package.json",
        }),
      ])
    );
  });
});
