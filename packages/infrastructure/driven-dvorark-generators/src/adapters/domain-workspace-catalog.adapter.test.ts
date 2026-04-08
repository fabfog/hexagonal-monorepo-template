import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DomainWorkspaceCatalogAdapter } from "./domain-workspace-catalog.adapter";

describe("DomainWorkspaceCatalogAdapter", () => {
  it("listDomainPackageSlugs returns empty when packages/domain is missing", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dvorark-catalog-"));
    const adapter = new DomainWorkspaceCatalogAdapter();
    await expect(adapter.listDomainPackageSlugs(tmp)).resolves.toEqual([]);
  });

  it("listVoFieldChoices merges local over core by class name", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dvorark-catalog-"));
    const coreVoDir = path.join(tmp, "packages", "domain", "core", "src", "value-objects");
    const featVoDir = path.join(tmp, "packages", "domain", "feat", "src", "value-objects");
    fs.mkdirSync(coreVoDir, { recursive: true });
    fs.mkdirSync(featVoDir, { recursive: true });
    fs.writeFileSync(
      path.join(coreVoDir, "dup.vo.ts"),
      "export class Dup { readonly value = 1; }\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(featVoDir, "dup.vo.ts"),
      "export class Dup { readonly value = 2; }\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(coreVoDir, "only-core.vo.ts"),
      "export class OnlyCore { readonly value = 1; }\n",
      "utf8"
    );

    const adapter = new DomainWorkspaceCatalogAdapter();
    const choices = await adapter.listVoFieldChoices(tmp, "feat");
    const labels = choices.map((c) => c.label);
    expect(labels.some((l) => l.includes("(@domain/feat)") && l.includes("Dup"))).toBe(true);
    expect(labels.some((l) => l.includes("(@domain/core)") && l.includes("OnlyCore"))).toBe(true);
    expect(labels.filter((l) => l.includes("Dup")).length).toBe(1);
  });
});
