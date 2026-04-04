const fs = require("fs");
const path = require("path");
const {
  getRepoRoot,
  toKebabCase,
  getDomainPackageNamesOrThrow,
  getApplicationPackageChoices,
  getDomainEntityChoices,
  packageJsonPath,
  packagePath,
  toPlopChoices,
} = require("../lib");
const { getApplicationPackageBaseActions } = require("./application-package.cjs");
const { ensureApplicationPackageSlice } = require("../lib/ensure-package-slice.cjs");
const { generateApplicationEntityMapperSources } = require("../lib/entity-to-dto-map-codegen.cjs");
const { runPnpmInstallWithConsentOrThrow } = require("../lib/pnpm-install.cjs");

const repoRoot = getRepoRoot();

/**
 * @param {unknown} err
 */
function isMapperCodegenUnresolvedDepsError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    (msg.includes("Could not infer properties") &&
      msg.includes("toSnapshot()") &&
      msg.includes("any")) ||
    (msg.includes("pnpm install") && msg.includes("workspace"))
  );
}

function getPackageNameChoices() {
  return toPlopChoices(getDomainPackageNamesOrThrow(repoRoot));
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerApplicationEntityToDtoMapperGenerator(plop) {
  plop.setGenerator("application-entity-to-dto-mapper", {
    description:
      "Add DTO + mapper for an existing Domain Entity into the corresponding @application/* package (if TypeScript cannot resolve deps, re-run with: pnpm plop application-entity-to-dto-mapper -- --confirm-install)",
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

      actions.push(() => {
        ensureApplicationPackageSlice(repoRoot, applicationPackage, "dtos");
        ensureApplicationPackageSlice(repoRoot, applicationPackage, "mappers");
      });

      actions.push(() => {
        const dtosDir = packagePath(repoRoot, "application", applicationPackage, "src", "dtos");
        const mappersDir = packagePath(
          repoRoot,
          "application",
          applicationPackage,
          "src",
          "mappers"
        );
        const dtoFile = path.join(dtosDir, `${entityKebab}.dto.ts`);
        const mapperFile = path.join(mappersDir, `${entityKebab}.mapper.ts`);
        const testFile = path.join(mappersDir, `${entityKebab}.mapper.test.ts`);

        for (const [filePath, label] of [
          [dtoFile, "DTO"],
          [mapperFile, "Mapper"],
          [testFile, "Mapper test"],
        ]) {
          if (fs.existsSync(filePath)) {
            throw new Error(
              `${label} already exists: ${path.relative(repoRoot, filePath)}. Remove it or choose another entity.`
            );
          }
        }

        const runCodegen = () =>
          generateApplicationEntityMapperSources({
            repoRoot,
            domainPackage: domainPackageName,
            entityBasePascal: entityName,
            applicationPackage,
          });

        /** @type {{ dtoSource: string, mapperSource: string, testSource: string }} */
        let bundle;
        try {
          bundle = runCodegen();
        } catch (e) {
          if (!isMapperCodegenUnresolvedDepsError(e)) throw e;
          runPnpmInstallWithConsentOrThrow(repoRoot, {
            context: e instanceof Error ? e.message : String(e),
          });
          bundle = runCodegen();
        }

        fs.writeFileSync(dtoFile, bundle.dtoSource);
        fs.writeFileSync(mapperFile, bundle.mapperSource);
        fs.writeFileSync(testFile, bundle.testSource);
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
