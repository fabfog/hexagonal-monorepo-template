const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");

function toKebabCase(value) {
  return String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function toPascalCase(value) {
  return String(value)
    .trim()
    .split(/[\s\-_/]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function getDomainPackageChoices() {
  const domainRoot = path.join(repoRoot, "packages", "domain");
  if (!fs.existsSync(domainRoot)) {
    throw new Error(`Domain packages folder is empty or missing. Expected path: ${domainRoot}`);
  }

  return fs
    .readdirSync(domainRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, value: entry.name }));
}

function getEntityChoices(domainPackage) {
  const entitiesDir = path.join(repoRoot, "packages", "domain", domainPackage, "src", "entities");
  if (!fs.existsSync(entitiesDir)) {
    throw new Error(
      `Domain package "${domainPackage}" has no entities folder. Expected path: ${entitiesDir}`
    );
  }

  const entities = fs
    .readdirSync(entitiesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".entity.ts"))
    .map((entry) => {
      const base = entry.name.replace(/\.entity\.ts$/, "");
      const pascal = toPascalCase(base);
      return {
        name: `${pascal}Entity (${entry.name})`,
        value: pascal,
      };
    });

  if (!entities.length) {
    throw new Error(`Domain package "${domainPackage}" has no entities.`);
  }

  return entities;
}

function getInfrastructurePackageChoices() {
  const infrastructureRoot = path.join(repoRoot, "packages", "infrastructure");
  if (!fs.existsSync(infrastructureRoot)) {
    throw new Error(
      `Infrastructure packages folder is empty or missing. Expected path: ${infrastructureRoot}`
    );
  }

  return fs
    .readdirSync(infrastructureRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, value: entry.name }));
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerInfrastructureRawToDomainEntityGenerator(plop) {
  plop.setGenerator("infrastructure-raw-to-domain-entity", {
    description: "Add a raw-to-domain-entity mapper scaffold in any @infrastructure/* package",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(),
      },
      {
        type: "list",
        name: "entityName",
        message: "Select domain entity:",
        choices: (answers) => getEntityChoices(answers.domainPackage),
      },
      {
        type: "list",
        name: "infrastructurePackage",
        message: "Select infrastructure package (target):",
        choices: getInfrastructurePackageChoices(),
      },
      {
        type: "input",
        name: "rawName",
        message:
          "Raw data type name (CASE-SENSITIVE: exact casing will be kept in code and only filename is converted to kebab-case):",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: (data) => {
      const { domainPackage, entityName, infrastructurePackage, rawName } = data;
      const rawNamePascal = toPascalCase(rawName);
      const rawNameKebab = toKebabCase(rawName);
      const entityClassName = `${entityName}Entity`;

      const actions = [];

      actions.push({
        type: "add",
        path: `../packages/infrastructure/${infrastructurePackage}/src/mappers/${rawNameKebab}-to-${toKebabCase(entityName)}.mapper.ts`,
        template: `import { ${entityClassName} } from '@domain/${domainPackage}';

export function map${rawNamePascal}To${entityClassName}(raw: ${rawName}): ${entityClassName} {
  // TODO: map raw data to ${entityClassName}
  throw new Error('Not implemented!');
}
`,
      });

      actions.push({
        type: "add",
        path: `../packages/infrastructure/${infrastructurePackage}/src/mappers/index.ts`,
        template: "export {};\n",
        skipIfExists: true,
      });

      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${infrastructurePackage}/src/mappers/index.ts`,
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${rawNameKebab}-to-${toKebabCase(entityName)}.mapper';`;

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const content = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${content}${exportLine}\n`;
        },
      });

      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${infrastructurePackage}/src/index.ts`,
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = "export * from './mappers';";

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const content = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${content}${exportLine}\n`;
        },
      });

      actions.push({
        type: "modify",
        path: `../packages/infrastructure/${infrastructurePackage}/package.json`,
        transform: (file) => {
          const pkg = JSON.parse(file);
          const domainDepName = `@domain/${toKebabCase(domainPackage)}`;

          pkg.dependencies = pkg.dependencies || {};

          if (!pkg.dependencies[domainDepName]) {
            pkg.dependencies[domainDepName] = "workspace:*";
          }

          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      return actions;
    },
  });
};
