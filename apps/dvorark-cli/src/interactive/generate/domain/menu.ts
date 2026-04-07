import { promptSelect } from "../../prompts";
import { runDomainEntityAddVoFieldWizard } from "./domain-entity-add-vo-field.wizard";
import { runDomainEntityWizard } from "./domain-entity.wizard";
import { runDomainPackageWizard } from "./domain-package.wizard";
import { runDomainValueObjectWizard } from "./domain-value-object.wizard";
import { runDomainErrorWizard } from "./domain-error.wizard";
import { runDomainServiceWizard } from "./domain-service.wizard";

export async function runDomainMenu(targetDirectory: string): Promise<void> {
  for (;;) {
    const choice = await promptSelect({
      message: "Domain",
      options: [
        { value: "domain-package", label: "Domain package" },
        { value: "domain-entity", label: "Domain entity" },
        {
          value: "domain-entity-add-vo-field",
          label: "Domain entity — add VO field",
        },
        { value: "domain-value-object", label: "Domain value object" },
        { value: "domain-error", label: "Domain error" },
        { value: "domain-service", label: "Domain service" },
        { value: "back", label: "Back" },
      ],
    });

    if (choice === "back") {
      return;
    }

    if (choice === "domain-package") {
      await runDomainPackageWizard({ workspaceRoot: targetDirectory });
    }

    if (choice === "domain-entity") {
      await runDomainEntityWizard({ workspaceRoot: targetDirectory });
    }

    if (choice === "domain-entity-add-vo-field") {
      await runDomainEntityAddVoFieldWizard({ workspaceRoot: targetDirectory });
    }

    if (choice === "domain-value-object") {
      await runDomainValueObjectWizard({ workspaceRoot: targetDirectory });
    }

    if (choice === "domain-error") {
      await runDomainErrorWizard({ workspaceRoot: targetDirectory });
    }

    if (choice === "domain-service") {
      await runDomainServiceWizard({ workspaceRoot: targetDirectory });
    }
  }
}
