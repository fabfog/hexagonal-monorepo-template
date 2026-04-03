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
      "Add a Value Object (single value VO or composite VO) to an existing @domain/* package",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(repoRoot, { excludeCore: false }),
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
            name: "Single value VO — wraps one primitive value (`value`)",
            value: "single-value",
          },
          {
            name: "Composite VO — object props + `getProps()` + default deep equals",
            value: "composite",
          },
        ],
        default: "single-value",
      },
      {
        type: "list",
        name: "singleValuePrimitive",
        message: "Single value primitive type:",
        choices: ["string", "boolean", "number", "Date"],
        default: "string",
        when: (answers) => answers.valueObjectKind === "single-value",
      },
    ],
    actions: (data) => {
      const { domainPackage, valueObjectName, valueObjectKind, singleValuePrimitive } = data;

      const actions = [];
      appendDomainValueObjectZodActions(actions, {
        repoRoot,
        domainPackage,
        valueObjectName,
        valueObjectKind,
        singleValuePrimitive,
      });
      actions.push(() => ensureZodDependencyInDomainPackage(repoRoot, domainPackage));

      return actions;
    },
  });
};
