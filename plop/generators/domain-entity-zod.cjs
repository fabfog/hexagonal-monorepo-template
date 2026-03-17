const fs = require("fs");
const path = require("path");

function toKebabCase(value) {
  return String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function getDomainPackageChoices() {
  const repoRoot = path.join(__dirname, "..", "..");
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
  const repoRoot = path.join(__dirname, "..", "..");
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
module.exports = function registerDomainEntityZodGenerator(plop) {
  plop.setGenerator("domain-entity-zod", {
    description: "Add a new Domain Entity with Zod schema to an existing @domain/* package",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(),
      },
      {
        type: "input",
        name: "entityName",
        message:
          "Entity base name (e.g. Document, UserProfile). Do not include Entity in the name, it will be added automatically:",
      },
    ],
    actions: (data) => {
      const { domainPackage, entityName } = data;
      const kebab = toKebabCase(entityName);

      const actions = [
        {
          type: "add",
          path: "../packages/domain/{{domainPackage}}/src/entities/{{kebabCase entityName}}.entity.ts",
          templateFile: "templates/domain-entity-zod/entity.ts.hbs",
        },
        {
          type: "modify",
          path: "../packages/domain/{{domainPackage}}/src/entities/index.ts",
          transform: (file) => {
            const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
            const exportLine = `export * from './${kebab}.entity';`;

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
