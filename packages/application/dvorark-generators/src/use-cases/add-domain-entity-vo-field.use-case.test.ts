import { describe, expect, it, vi } from "vitest";
import { AddDomainEntityVoFieldUseCase } from "./add-domain-entity-vo-field.use-case";

const entityRel = "packages/domain/acme/src/entities/ticket.entity.ts";
const pkgRel = "packages/domain/acme/package.json";

describe("AddDomainEntityVoFieldUseCase", () => {
  it("patches entity and package.json when core VO requires @domain/core", async () => {
    const entitySrc = `import { z } from "zod";

import { TicketId } from "../value-objects/ticket-id.vo";

export const TicketSchema = z.object({
});

export type TicketDataProps = z.infer<typeof TicketSchema>;
`;

    const workspaceWriter = { writeFiles: vi.fn().mockResolvedValue(undefined) };
    const workspaceReader = {
      readTextIfExists: vi.fn(async (_root: string, rel: string) => {
        if (rel === entityRel) {
          return entitySrc;
        }
        if (rel === pkgRel) {
          return JSON.stringify({ name: "@domain/acme", dependencies: { zod: "^3.0.0" } }, null, 2);
        }
        return null;
      }),
    };
    const generatorToolingDefaults = {
      vitestRange: vi.fn(async () => "^4.1.0"),
      zodRange: vi.fn(async () => "^3.23.8"),
    };

    const uc = new AddDomainEntityVoFieldUseCase({
      workspaceReader,
      workspaceWriter,
      generatorToolingDefaults,
    });

    const out = await uc.execute({
      workspaceRoot: "/ws",
      domainPackageSlugInput: "acme",
      entityPascalInput: "Ticket",
      propertyNameInput: "locale",
      voClass: "LocaleCode",
      voSource: "core",
    });

    expect(out.filesWritten).toBe(2);
    expect(out.propertyName).toBe("locale");
    expect(generatorToolingDefaults.zodRange).toHaveBeenCalledWith("/ws");

    const written = workspaceWriter.writeFiles.mock.calls[0][1] as {
      relativePath: string;
      contents: string;
    }[];
    const entityWrite = written.find((f) => f.relativePath === entityRel);
    expect(entityWrite?.contents).toContain("LocaleCode");
    const pkgWrite = written.find((f) => f.relativePath === pkgRel);
    expect(pkgWrite?.contents).toContain("@domain/core");
  });

  it("writes only entity when package.json is missing", async () => {
    const workspaceWriter = { writeFiles: vi.fn().mockResolvedValue(undefined) };
    const workspaceReader = {
      readTextIfExists: vi.fn(async (_root: string, rel: string) => {
        if (rel === entityRel) {
          return `import { z } from "zod";
import { TicketId } from "../value-objects/ticket-id.vo";
export const TicketSchema = z.object({});
export type TicketDataProps = z.infer<typeof TicketSchema>;
`;
        }
        return null;
      }),
    };
    const generatorToolingDefaults = {
      vitestRange: vi.fn(async () => "^4.1.0"),
      zodRange: vi.fn(async () => "^3.23.8"),
    };

    const uc = new AddDomainEntityVoFieldUseCase({
      workspaceReader,
      workspaceWriter,
      generatorToolingDefaults,
    });

    const out = await uc.execute({
      workspaceRoot: "/ws",
      domainPackageSlugInput: "acme",
      entityPascalInput: "Ticket",
      propertyNameInput: "sku",
      voClass: "Sku",
      voSource: "local",
    });

    expect(out.filesWritten).toBe(1);
  });
});
