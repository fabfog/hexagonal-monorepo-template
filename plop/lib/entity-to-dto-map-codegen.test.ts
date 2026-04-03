import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { generateApplicationEntityMapperSources } = require("./entity-to-dto-map-codegen.cjs") as {
  generateApplicationEntityMapperSources: (opts: {
    repoRoot: string;
    domainPackage: string;
    entityBasePascal: string;
    applicationPackage: string;
  }) => { dtoSource: string; mapperSource: string; testSource: string };
};

const repoRoot = path.join(import.meta.dirname, "..", "fixtures", "entity-to-dto-codegen", "repo");

describe("generateApplicationEntityMapperSources", () => {
  it("infers DTO fields and mapper body from toSnapshot()", () => {
    const out = generateApplicationEntityMapperSources({
      repoRoot,
      domainPackage: "fixture-codegen-entity",
      entityBasePascal: "Ticket",
      applicationPackage: "fixture-codegen-app",
    });

    expect(out.dtoSource).toContain("id: string");
    expect(out.dtoSource).toContain("title: string");
    expect(out.dtoSource).toContain("count: number");
    expect(out.dtoSource).toMatch(/locale:\s*\{[^}]*language:\s*string[^}]*country:\s*string/s);

    expect(out.mapperSource).toContain("snapshot.id.value");
    expect(out.mapperSource).toContain("snapshot.title");
    expect(out.mapperSource).toContain("snapshot.count");
    expect(out.mapperSource).toContain("snapshot.locale.getProps()");

    expect(out.testSource).toContain("mapTicketToDTO");
    expect(out.testSource).toContain("toEqual");
    expect(out.testSource).toContain("new TicketEntity(");
    expect(out.testSource).not.toMatch(/as unknown/);
  });
});
