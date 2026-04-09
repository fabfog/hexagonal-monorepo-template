import type { ActionType, NodePlopAPI } from "node-plop";
import { appendDomainValueObjectActions } from "../lib/domain-value-object.ts";
import type { Answers } from "inquirer";
import {
  getRepoRoot,
  getDomainPackageChoices,
  ensureZodDependencyInDomainPackage,
} from "../lib/index.ts";
const repoRoot = getRepoRoot();
export default function registerDomainValueObjectGenerator(plop: NodePlopAPI) {
  plop.setGenerator("domain-value-object", {
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
        validate: (value: unknown) =>
          String(value || "").trim().length > 0 || "Name cannot be empty",
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
        when: (answers: Answers) => answers.valueObjectKind === "single-value",
      },
    ],
    actions: (data?: Answers) => {
      if (!data) return [];
      const { domainPackage, valueObjectName, valueObjectKind, singleValuePrimitive } = data;
      const actions: ActionType[] = [];
      appendDomainValueObjectActions(actions, {
        repoRoot,
        domainPackage,
        valueObjectName,
        valueObjectKind,
        singleValuePrimitive,
      });
      actions.push(() => {
        ensureZodDependencyInDomainPackage(repoRoot, domainPackage);
        return "";
      });
      return actions;
    },
  });
}
