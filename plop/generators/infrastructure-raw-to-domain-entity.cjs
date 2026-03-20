const fs = require("fs");
const path = require("path");
const { getRepoRoot, toKebabCase, toPascalCase } = require("../lib");

const repoRoot = getRepoRoot();

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
      const mapperFileBase = `${rawNameKebab}-to-${toKebabCase(entityName)}`;

      const actions = [];

      actions.push({
        type: "add",
        path: `../packages/infrastructure/${infrastructurePackage}/src/mappers/${mapperFileBase}.mapper.ts`,
        template: `import { ${entityClassName} } from '@domain/${domainPackage}';

export function map${rawNamePascal}To${entityClassName}(raw: ${rawName}): ${entityClassName} {
  // TODO: map raw data to ${entityClassName}
  throw new Error('Not implemented!');
}
`,
      });

      actions.push({
        type: "add",
        path: `../packages/infrastructure/${infrastructurePackage}/src/mappers/${mapperFileBase}.mapper.test.ts`,
        template: `import { describe, it, expect } from 'vitest';
import { map${rawNamePascal}To${entityClassName} } from './${mapperFileBase}.mapper';

describe('map${rawNamePascal}To${entityClassName}', () => {
  it('throws until implemented', () => {
    expect(() => map${rawNamePascal}To${entityClassName}({} as never)).toThrow(/Not implemented/);
  });
});
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
          const exportLine = `export * from './${mapperFileBase}.mapper';`;

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

          pkg.devDependencies = pkg.devDependencies || {};
          if (!pkg.devDependencies.vitest) {
            pkg.devDependencies.vitest = "^4.1.0";
          }
          pkg.scripts = pkg.scripts || {};
          if (!pkg.scripts.test || String(pkg.scripts.test).includes("No tests yet")) {
            pkg.scripts.test = "vitest run";
          }

          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      return actions;
    },
  });
};
