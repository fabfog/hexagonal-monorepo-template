import type { ActionType } from "node-plop";
import { toKebabCase } from "./casing.ts";
import { ensureDomainPackageSlice } from "./ensure-package-slice.ts";

interface AppendDomainValueObjectOpts {
  repoRoot: string;
  domainPackage: string;
  valueObjectName: string;
  valueObjectKind?: "single-value" | "composite";
  singleValuePrimitive?: "string" | "boolean" | "number" | "Date";
}
/**
 * Appends "add .vo.ts + patch value-objects/index.ts" steps (same as generator `domain-value-object`).
 *
 * @param {unknown[]} actions
 * @param {{ repoRoot: string, domainPackage: string, valueObjectName: string, valueObjectKind?: 'single-value' | 'composite', singleValuePrimitive?: 'string' | 'boolean' | 'number' | 'Date' }} opts
 */
function appendDomainValueObjectActions(
  actions: (ActionType | (() => string))[],
  opts: AppendDomainValueObjectOpts
) {
  const { repoRoot, domainPackage, valueObjectName } = opts;
  if (!repoRoot) {
    throw new Error("appendDomainValueObjectActions requires repoRoot");
  }
  const valueObjectKind = opts.valueObjectKind ?? "single-value";
  const singleValuePrimitive = opts.singleValuePrimitive ?? "string";
  const kebab = toKebabCase(valueObjectName);
  const primitiveSchemaByType = {
    string: "z.string().min(1)",
    boolean: "z.boolean()",
    number: "z.number()",
    Date: "z.date()",
  };
  type Prim = keyof typeof primitiveSchemaByType;
  const equalsBodyByType: Record<Prim, string> = {
    string: "return other.value === this.value;",
    boolean: "return other.value === this.value;",
    number: "return other.value === this.value;",
    Date: "return other.value.getTime() === this.value.getTime();",
  };
  const prim = singleValuePrimitive as Prim;
  const voData = {
    domainPackage,
    valueObjectName,
    valueObjectKind,
    singleValuePrimitive,
    singleValueSchema: primitiveSchemaByType[prim],
    singleValueEqualsBody: equalsBodyByType[prim],
  };
  const templateFile =
    valueObjectKind === "composite"
      ? "templates/domain-value-object/value-object-composite.ts.hbs"
      : "templates/domain-value-object/value-object-single-value.ts.hbs";
  actions.unshift(() => {
    ensureDomainPackageSlice(repoRoot, domainPackage, "value-objects");
    return "";
  });
  actions.push(
    {
      type: "add",
      path: `../packages/domain/${domainPackage}/src/value-objects/${kebab}.vo.ts`,
      templateFile,
      data: voData,
    },
    {
      type: "modify",
      path: `../packages/domain/${domainPackage}/src/value-objects/index.ts`,
      transform: (file: string) => {
        const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
        const exportLine = `export * from './${kebab}.vo';`;
        if (cleaned.includes(exportLine)) {
          return `${cleaned}\n`;
        }
        const base = cleaned.length > 0 ? `${cleaned}\n` : "";
        return `${base}${exportLine}\n`;
      },
    }
  );
}
export { appendDomainValueObjectActions };
