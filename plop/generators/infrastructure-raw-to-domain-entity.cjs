const {
  getRepoRoot,
  toKebabCase,
  toPascalCase,
  getDomainPackageNamesOrThrow,
  toPlopChoices,
  getDomainEntityChoices,
  getInfrastructurePackageChoices,
} = require("../lib");

const repoRoot = getRepoRoot();

function getDomainPackageChoices() {
  return toPlopChoices(getDomainPackageNamesOrThrow(repoRoot, { excludeCore: false }));
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
        choices: (answers) => getDomainEntityChoices(repoRoot, answers.domainPackage),
      },
      {
        type: "list",
        name: "infrastructurePackage",
        message: "Select infrastructure package (target):",
        choices: getInfrastructurePackageChoices(repoRoot),
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
        template: `import { ${entityClassName} } from '@domain/${domainPackage}/entities';

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
