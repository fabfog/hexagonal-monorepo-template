import type { NodePlopAPI } from "node-plop";
import { ensureDomainPackageSlice } from "../lib/ensure-package-slice.ts";
import type { Answers } from "inquirer";
import {
  getRepoRoot,
  toKebabCase,
  getDomainPackageChoices,
  getDomainEntityChoices,
} from "../lib/index.ts";
const repoRoot = getRepoRoot();
export default function registerDomainServiceGenerator(plop: NodePlopAPI) {
  plop.setGenerator("domain-service", {
    description:
      "Add a domain service (execute + Input/Output types) to a @domain/* package, importing selected entities",
    prompts: [
      {
        type: "list",
        name: "domainPackage",
        message: "Select domain package:",
        choices: getDomainPackageChoices(repoRoot),
      },
      {
        type: "checkbox",
        name: "selectedEntities",
        message: "Select one or more entities this service will use (space to toggle):",
        choices: (answers: Answers) => getDomainEntityChoices(repoRoot, answers.domainPackage),
        validate: (selected: unknown) =>
          Array.isArray(selected) && selected.length > 0 ? true : "Select at least one entity",
      },
      {
        type: "input",
        name: "serviceName",
        message:
          "Service base name (WITHOUT the 'Service' suffix). Prefer a specific capability, e.g. UserDiscountEligibility, OrderShippingWindow — avoid vague names like User or UserService:",
        validate: (value: unknown) => {
          const trimmed = String(value || "").trim();
          if (!trimmed) return "Name cannot be empty";
          return true;
        },
        filter: (value: unknown) =>
          String(value || "")
            .trim()
            .replace(/Service$/i, ""),
      },
    ],
    actions: (data?: Answers) => {
      if (!data) return [];
      const { domainPackage, serviceName } = data;
      const kebab = toKebabCase(serviceName);
      /** @type {import('node-plop').ActionType[]} */
      const actions = [];
      actions.push(() => {
        ensureDomainPackageSlice(repoRoot, domainPackage, "services");
        return "";
      });
      actions.push({
        type: "add",
        path: `../packages/domain/${domainPackage}/src/services/${kebab}.service.ts`,
        templateFile: "templates/domain-service/service.ts.hbs",
      });
      actions.push({
        type: "modify",
        path: `../packages/domain/${domainPackage}/src/services/index.ts`,
        transform: (file: string) => {
          const cleaned = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const exportLine = `export * from './${kebab}.service';`;
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
}
