import { describe, expect, it } from "vitest";
import { appendVoFieldToEntitySource } from "./append-vo-field-to-entity-source";

const minimalEntity = `import { z } from "zod";

import { TicketId } from "../value-objects/ticket-id.vo";

export const TicketSchema = z.object({
  // TODO
});

export type TicketDataProps = z.infer<typeof TicketSchema>;
`;

describe("appendVoFieldToEntitySource", () => {
  it("inserts first VO field into empty schema body and adds local barrel import", () => {
    const out = appendVoFieldToEntitySource(minimalEntity, "Ticket", {
      prop: "email",
      voClass: "Email",
      source: "local",
    });
    expect(out).toMatch(/email:\s*EmailSchema\.transform\([^)]*=>\s*new Email\(x\)\)/);
    expect(out).toMatch(/import \{ Email, EmailSchema \} from ["']\.\.\/value-objects["']/);
    expect(out).toContain('from "../value-objects/ticket-id.vo"');
  });

  it("merges core VO imports", () => {
    const out = appendVoFieldToEntitySource(minimalEntity, "Ticket", {
      prop: "locale",
      voClass: "LocaleCode",
      source: "core",
    });
    expect(out).toMatch(/locale:\s*LocaleCodeSchema\.transform\([^)]*=>\s*new LocaleCode\(x\)\)/);
    expect(out).toContain("@domain/core/value-objects");
    expect(out).toContain("LocaleCode");
  });

  it("throws when property already exists", () => {
    const withEmail = appendVoFieldToEntitySource(minimalEntity, "Ticket", {
      prop: "email",
      voClass: "Email",
      source: "local",
    });
    expect(() =>
      appendVoFieldToEntitySource(withEmail, "Ticket", {
        prop: "email",
        voClass: "Email",
        source: "local",
      })
    ).toThrow(/already exists/);
  });
});
