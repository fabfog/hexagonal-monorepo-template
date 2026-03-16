const fs = require("fs");
const path = require("path");
const { getApplicationPackageBaseActions } = require("./application-package.cjs");

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

const repoRoot = path.join(__dirname, "..", "..");

function getPackageNameChoices() {
  const domainRoot = path.join(repoRoot, "packages", "domain");
  if (!fs.existsSync(domainRoot)) {
    throw new Error(`Domain packages folder is empty or missing. Expected path: ${domainRoot}`);
  }

  return fs
    .readdirSync(domainRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "core")
    .map((entry) => ({ name: entry.name, value: entry.name }));
}

function getEntityChoices(packageName) {
  const entitiesDir = path.join(repoRoot, "packages", "domain", packageName, "src", "entities");

  if (!fs.existsSync(entitiesDir)) {
    throw new Error(
      `Domain package "${packageName}" has no entities folder. Expected path: ${entitiesDir}`
    );
  }

  return fs
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
        choices: (answers) => getEntityChoices(answers.packageName),
      },
      {
        type: "confirm",
        name: "autoCreateApplication",
        message: "No matching application package found. Create @application/<name> if needed?",
        default: true,
        when: (answers) => {
          const appPackageDir = path.join(
            repoRoot,
            "packages",
            "application",
            answers.packageName,
            "package.json"
          );
          return !fs.existsSync(appPackageDir);
        },
      },
    ],
    actions: (data) => {
      const { packageName, entityName, autoCreateApplication } = data;
      const appPackageJsonPath = path.join(
        repoRoot,
        "packages",
        "application",
        packageName,
        "package.json"
      );

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      if (!fs.existsSync(appPackageJsonPath)) {
        if (!autoCreateApplication) {
          throw new Error(
            `Application package @application/${packageName} does not exist. Create it first or enable auto-create.`
          );
        }

        // Reuse application-package base actions for skeleton creation
        actions.push(...getApplicationPackageBaseActions("{{kebabCase packageName}}"));
      }

      // Ensure application package depends on corresponding domain package
      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/package.json",
        transform: (file) => {
          const pkg = JSON.parse(file);
          const domainDepName = `@domain/${toKebabCase(packageName)}`;

          pkg.dependencies = pkg.dependencies || {};

          if (!pkg.dependencies[domainDepName]) {
            pkg.dependencies[domainDepName] = "workspace:*";
          }

          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      // DTO file
      actions.push({
        type: "add",
        path: "../packages/application/{{packageName}}/src/dtos/{{kebabCase entityName}}.dto.ts",
        templateFile: "templates/domain-entity-dto-mapper/dto.ts.hbs",
      });

      // Mapper file
      actions.push({
        type: "add",
        path: "../packages/application/{{packageName}}/src/mappers/{{kebabCase entityName}}.mapper.ts",
        templateFile: "templates/domain-entity-dto-mapper/mapper.ts.hbs",
      });

      // Update dtos barrel
      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/src/dtos/index.ts",
        transform: (file) => {
          const kebab = toKebabCase(entityName);
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
        path: "../packages/application/{{packageName}}/src/mappers/index.ts",
        transform: (file) => {
          const kebab = toKebabCase(entityName);
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
