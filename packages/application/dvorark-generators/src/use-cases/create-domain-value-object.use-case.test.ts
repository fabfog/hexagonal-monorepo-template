import { describe, expect, it, vi } from "vitest";
import {
  CreateDomainValueObjectUseCase,
  DOMAIN_VALUE_OBJECT_GENERATOR_ID,
} from "./create-domain-value-object.use-case";

describe("CreateDomainValueObjectUseCase", () => {
  it("writes single-value VO, barrel, and patches domain package.json", async () => {
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
        if (rel.endsWith("package.json")) {
          return JSON.stringify({ name: "@domain/test", dependencies: {} }, null, 2);
        }
        if (rel.endsWith("value-objects/index.ts")) {
          return null;
        }
        return null;
      }),
    };
    const generatorToolingDefaults = {
      vitestRange: vi.fn(async () => "^4.1.0"),
      zodRange: vi.fn(async () => "^3.23.8"),
    };
    const generatorBlueprintSource = {
      load: vi.fn(async () => [
        {
          relativePath: "vo-single-value.ts",
          kind: "template" as const,
          contents: "single-tpl",
        },
        {
          relativePath: "vo-composite.ts",
          kind: "template" as const,
          contents: "composite-tpl",
        },
      ]),
    };

    const uc = new CreateDomainValueObjectUseCase({
      templateRenderer,
      workspaceWriter,
      workspaceReader,
      generatorBlueprintSource,
      generatorToolingDefaults,
    });

    const out = await uc.execute({
      workspaceRoot: "/tmp/ws",
      domainPackageSlugInput: "fixture-codegen-entity",
      valueObjectSlugInput: "TicketId",
      valueObjectKind: "single-value",
      singleValuePrimitive: "string",
    });

    expect(out.valueObjectSlug).toBe("ticket-id");
    expect(out.domainPackageSlug).toBe("fixture-codegen-entity");
    expect(out.valueObjectKind).toBe("single-value");
    expect(out.filesWritten).toBe(3);
    expect(generatorBlueprintSource.load).toHaveBeenCalledWith(DOMAIN_VALUE_OBJECT_GENERATOR_ID);

    expect(workspaceWriter.writeFiles).toHaveBeenCalledWith(
      "/tmp/ws",
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "packages/domain/fixture-codegen-entity/src/value-objects/ticket-id.vo.ts",
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

  it("writes composite VO using vo-composite template", async () => {
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
        if (rel.endsWith("package.json")) {
          return JSON.stringify({ name: "@domain/test", dependencies: {} }, null, 2);
        }
        if (rel.endsWith("value-objects/index.ts")) {
          return "export {};\n";
        }
        return null;
      }),
    };
    const generatorToolingDefaults = {
      vitestRange: vi.fn(async () => "^4.1.0"),
      zodRange: vi.fn(async () => "^3.23.8"),
    };
    const generatorBlueprintSource = {
      load: vi.fn(async () => [
        {
          relativePath: "vo-single-value.ts",
          kind: "template" as const,
          contents: "single-tpl",
        },
        {
          relativePath: "vo-composite.ts",
          kind: "template" as const,
          contents: "composite-tpl",
        },
      ]),
    };

    const uc = new CreateDomainValueObjectUseCase({
      templateRenderer,
      workspaceWriter,
      workspaceReader,
      generatorBlueprintSource,
      generatorToolingDefaults,
    });

    await uc.execute({
      workspaceRoot: "/tmp/ws",
      domainPackageSlugInput: "fixture-codegen-entity",
      valueObjectSlugInput: "MoneyAmount",
      valueObjectKind: "composite",
    });

    expect(templateRenderer.render).toHaveBeenCalledWith(
      "composite-tpl",
      expect.objectContaining({ valueObjectPascal: "MoneyAmount" })
    );
  });
});
