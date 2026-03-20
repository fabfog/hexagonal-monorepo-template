const fs = require("fs");
const path = require("path");
const { getRepoRoot, toKebabCase } = require("../lib");

const repoRoot = getRepoRoot();

function getDomainPackageChoices() {
  const domainRoot = path.join(repoRoot, "packages", "domain");
  if (!fs.existsSync(domainRoot)) return [];

  return fs
    .readdirSync(domainRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "core")
    .map((entry) => ({
      name: entry.name,
      value: entry.name,
    }));
}

function ensureZodDependency(domainPackageName) {
  const pkgPath = path.join(repoRoot, "packages", "domain", domainPackageName, "package.json");
  if (!fs.existsSync(pkgPath)) return "package.json not found, skipped zod dependency";

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.dependencies = pkg.dependencies || {};
  if (!pkg.dependencies.zod) {
    pkg.dependencies.zod = "^3.23.8";
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    return "Added zod dependency to domain package";
  }
  return "zod already present in domain package dependencies";
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainValueObjectZodGenerator(plop) {
  plop.setGenerator("domain-value-object-zod", {
    description: "Add a new Value Object with Zod schema to an existing @domain/* package",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(),
      },
      {
        type: "input",
        name: "valueObjectName",
        message:
          "Value Object base name (e.g. UserId, EmailAddress). Do not include ValueObject in the name, it will be added automatically:",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: (data) => {
      const { domainPackage, valueObjectName } = data;
      const kebab = toKebabCase(valueObjectName);

      const actions = [
        {
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/value-objects/{{kebabCase valueObjectName}}.vo.ts",
          templateFile: "templates/domain-value-object-zod/value-object.ts.hbs",
        },
        {
          type: "modify",
          path: "../packages/domain/{{domainPackage}}/src/value-objects/index.ts",
          transform: (file) => {
            const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
            const exportLine = `export * from './${kebab}.vo';`;

            if (cleaned.includes(exportLine)) {
              return `${cleaned}\n`;
            }

            const base = cleaned.length > 0 ? `${cleaned}\n` : "";
            return `${base}${exportLine}\n`;
          },
        },
        () => ensureZodDependency(domainPackage),
      ];

      return actions;
    },
  });
};
