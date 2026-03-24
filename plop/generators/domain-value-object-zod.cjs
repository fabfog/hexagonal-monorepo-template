const {
  getRepoRoot,
  getDomainPackageChoices,
  ensureZodDependencyInDomainPackage,
} = require("../lib");
const { appendDomainValueObjectZodActions } = require("../lib/domain-value-object-zod.cjs");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerDomainValueObjectZodGenerator(plop) {
  plop.setGenerator("domain-value-object-zod", {
    description:
      "Add a Value Object (string value, or full object VO with getProps) to an existing @domain/* package",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "valueObjectName",
        message:
          "Value Object base name (e.g. UserId, EmailAddress). Class name matches this exactly; file will be `<kebab>.vo.ts`.",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
      {
        type: "list",
        name: "valueObjectKind",
        message: "VO shape:",
        choices: [
          {
            name: "String value — required `value: string`, getter `value`, `equals` on `value`",
            value: "string",
          },
          {
            name: "Object — arbitrary z.object, `getProps()`, you implement `equals`",
            value: "object",
          },
        ],
        default: "string",
      },
    ],
    actions: (data) => {
      const { domainPackage, valueObjectName, valueObjectKind } = data;

      const actions = [];
      appendDomainValueObjectZodActions(actions, {
        domainPackage,
        valueObjectName,
        valueObjectKind,
      });
      actions.push(() => ensureZodDependencyInDomainPackage(repoRoot, domainPackage));

      return actions;
    },
  });
};
