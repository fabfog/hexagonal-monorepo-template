const { toKebabCase } = require("./casing.cjs");
const { ensureDomainPackageSlice } = require("./ensure-package-slice.cjs");

/**
 * Appends the same "add .vo.ts + patch value-objects/index.ts" steps as generator `domain-value-object-zod`.
 *
 * @param {unknown[]} actions
 * @param {{ repoRoot: string, domainPackage: string, valueObjectName: string, valueObjectKind?: 'string' | 'object' }} opts
 */
function appendDomainValueObjectZodActions(actions, opts) {
  const { repoRoot, domainPackage, valueObjectName } = opts;
  if (!repoRoot) {
    throw new Error("appendDomainValueObjectZodActions requires repoRoot");
  }
  const valueObjectKind = opts.valueObjectKind ?? "string";
  const kebab = toKebabCase(valueObjectName);
  const voData = { domainPackage, valueObjectName, valueObjectKind };
  const templateFile =
    valueObjectKind === "object"
      ? "templates/domain-value-object-zod/value-object-object.ts.hbs"
      : "templates/domain-value-object-zod/value-object-string.ts.hbs";

  actions.unshift(() => {
    ensureDomainPackageSlice(repoRoot, domainPackage, "value-objects");
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
      transform: (file) => {
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

module.exports = { appendDomainValueObjectZodActions };
