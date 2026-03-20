const fs = require("fs");
const {
  getRepoRoot,
  toKebabCase,
  getDomainPackageNamesOrThrow,
  getApplicationPackageChoices,
  getDomainEntityChoices,
  packageJsonPath,
  toPlopChoices,
} = require("../lib");
const { getApplicationPackageBaseActions } = require("./application-package.cjs");

const repoRoot = getRepoRoot();

function getPackageNameChoices() {
  return toPlopChoices(getDomainPackageNamesOrThrow(repoRoot));
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainEntityDtoMapperGenerator(plop) {
  plop.setGenerator("application-dto-mapper-for-entity", {
    description:
      "Add DTO + mapper for an existing Domain Entity into the corresponding @application/* package",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select domain package:",
        choices: getPackageNameChoices(),
      },
      {
        type: "list",
        name: "entityName",
        message: "Select entity:",
        choices: (answers) => getDomainEntityChoices(repoRoot, answers.packageName),
      },
      {
        type: "confirm",
        name: "autoCreateApplication",
        message: "No matching application package found. Create @application/<name> if needed?",
        default: true,
        when: (answers) =>
          !fs.existsSync(packageJsonPath(repoRoot, "application", answers.packageName)),
      },
      {
        type: "list",
        name: "targetApplicationPackage",
        message: "Select another existing application package:",
        choices: getApplicationPackageChoices(repoRoot),
        when: (answers) => {
          const defaultAppMissing = !fs.existsSync(
            packageJsonPath(repoRoot, "application", answers.packageName)
          );
          return defaultAppMissing && answers.autoCreateApplication === false;
        },
      },
    ],
    actions: (data) => {
      const {
        packageName: domainPackageName,
        entityName,
        autoCreateApplication,
        targetApplicationPackage,
      } = data;
      const entityKebab = toKebabCase(entityName);

      const defaultAppPackageJsonPath = packageJsonPath(repoRoot, "application", domainPackageName);

      const defaultAppExists = fs.existsSync(defaultAppPackageJsonPath);

      const applicationPackage = defaultAppExists
        ? domainPackageName
        : autoCreateApplication
          ? domainPackageName
          : targetApplicationPackage;

      if (!applicationPackage) {
        throw new Error(
          `No application package selected. Create @application/${domainPackageName} or choose an existing one.`
        );
      }

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      if (!defaultAppExists && autoCreateApplication) {
        // Reuse application-package base actions for skeleton creation
        actions.push(...getApplicationPackageBaseActions("{{kebabCase packageName}}"));
      }

      // Ensure domain dependency + Vitest for mapper tests
      actions.push({
        type: "modify",
        path: `../packages/application/${applicationPackage}/package.json`,
        transform: (file) => {
          const pkg = JSON.parse(file);
          const domainDepName = `@domain/${toKebabCase(domainPackageName)}`;

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

      // DTO file
      actions.push({
        type: "add",
        path: `../packages/application/${applicationPackage}/src/dtos/${entityKebab}.dto.ts`,
        templateFile: "templates/application-dto-mapper-for-entity/dto.ts.hbs",
      });

      // Mapper file
      actions.push({
        type: "add",
        path: `../packages/application/${applicationPackage}/src/mappers/${entityKebab}.mapper.ts`,
        templateFile: "templates/application-dto-mapper-for-entity/mapper.ts.hbs",
      });

      // Mapper test file
      actions.push({
        type: "add",
        path: `../packages/application/${applicationPackage}/src/mappers/${entityKebab}.mapper.test.ts`,
        templateFile: "templates/application-dto-mapper-for-entity/mapper.test.ts.hbs",
      });

      // Update dtos barrel
      actions.push({
        type: "modify",
        path: `../packages/application/${applicationPackage}/src/dtos/index.ts`,
        transform: (file) => {
          const kebab = entityKebab;
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${kebab}.dto';`;

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const base = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${base}${exportLine}\n`;
        },
      });

      // Update mappers barrel
      actions.push({
        type: "modify",
        path: `../packages/application/${applicationPackage}/src/mappers/index.ts`,
        transform: (file) => {
          const kebab = entityKebab;
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${kebab}.mapper';`;

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const base = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${base}${exportLine}\n`;
        },
      });

      return actions;
    },
  });
};
