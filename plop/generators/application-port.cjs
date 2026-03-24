const {
  getRepoRoot,
  toKebabCase,
  getApplicationPackageChoices,
  getDomainPackageChoices,
  getDomainEntityChoices,
} = require("../lib");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerApplicationPortGenerator(plop) {
  plop.setGenerator("application-port", {
    description:
      "Add a new Port or InteractionPort to an existing @application/* package (repository ports get a minimal getById signature)",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select application package:",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "portKind",
        message: "What kind of port is this?",
        choices: [
          { name: "InteractionPort (UI / interaction contract)", value: "interaction" },
          { name: "Repository port (persistence; includes minimal getById)", value: "repository" },
          { name: "Other (normal Port, empty contract TODO)", value: "other" },
        ],
      },
      {
        type: "list",
        name: "domainPackageForEntity",
        message: "Domain package for the entity returned by getById:",
        choices: getDomainPackageChoices(repoRoot),
        when: (answers) => answers.portKind === "repository",
      },
      {
        type: "list",
        name: "entityPascal",
        message: "Entity for getById return type:",
        choices: (answers) => getDomainEntityChoices(repoRoot, answers.domainPackageForEntity),
        when: (answers) => answers.portKind === "repository",
      },
      {
        type: "input",
        name: "repositoryBaseName",
        message: (answers) => {
          const e = answers.entityPascal || "Entity";
          return (
            `Repository base name (before the Port suffix, e.g. ${e}Repository → ${e}RepositoryPort). ` +
            `Leave empty to use default: ${e}Repository.`
          );
        },
        when: (answers) => answers.portKind === "repository",
      },
      {
        type: "input",
        name: "portName",
        message:
          "Port base name (e.g. PageRepository, UserNotification). Do not include Port/InteractionPort in the name, it will be added automatically:",
        when: (answers) => answers.portKind !== "repository",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
    ],
    actions: (data) => {
      const { packageName, portKind } = data;

      const entityPascalForDefault = String(data.entityPascal || "").trim();
      const rawRepositoryBase =
        portKind === "repository"
          ? String(data.repositoryBaseName || "").trim() || `${entityPascalForDefault}Repository`
          : "";
      const rawPortName =
        portKind === "repository" ? rawRepositoryBase : String(data.portName || "").trim();

      const baseName = rawPortName
        .replace(/Port$/i, "")
        .replace(/InteractionPort$/i, "")
        .replace(/Interaction$/i, "");

      const isInteractionPort = portKind === "interaction";
      const isRepositoryPort = portKind === "repository";

      const interfaceName = isInteractionPort ? `${baseName}InteractionPort` : `${baseName}Port`;

      const fileBase = toKebabCase(baseName);
      const fileSuffix = isInteractionPort
        ? ".interaction.port"
        : isRepositoryPort
          ? ".repository.port"
          : ".port";
      const filePath = `../packages/application/${packageName}/src/ports/${fileBase}${fileSuffix}.ts`;

      const entityPascal = isRepositoryPort ? entityPascalForDefault : "";
      const getByIdReturnType = isRepositoryPort && entityPascal ? `${entityPascal}Entity` : "";
      const domainPackageForEntity = isRepositoryPort
        ? String(data.domainPackageForEntity || "").trim()
        : "";

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      actions.push({
        type: "add",
        path: filePath,
        templateFile: "templates/application-port/port.ts.hbs",
        data: {
          interfaceName,
          isRepositoryPort,
          getByIdReturnType,
          domainPackageForEntity,
        },
      });

      actions.push({
        type: "modify",
        path: "../packages/application/{{packageName}}/src/ports/index.ts",
        transform: (file) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${fileBase}${fileSuffix}';`;

          if (cleaned.includes(exportLine)) {
            return `${cleaned}\n`;
          }

          const base = cleaned.length > 0 ? `${cleaned}\n` : "";
          return `${base}${exportLine}\n`;
        },
      });

      if (isRepositoryPort && domainPackageForEntity) {
        actions.push({
          type: "modify",
          path: `../packages/application/${packageName}/package.json`,
          transform: (file) => {
            const pkg = JSON.parse(file);
            const dep = `@domain/${domainPackageForEntity}`;
            pkg.dependencies = pkg.dependencies || {};
            if (!pkg.dependencies[dep]) {
              pkg.dependencies[dep] = "workspace:*";
            }
            return `${JSON.stringify(pkg, null, 2)}\n`;
          },
        });
      }

      return actions;
    },
  });
};
