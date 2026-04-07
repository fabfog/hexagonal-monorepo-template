import { promptSelect } from "../../prompts";
import { runDomainEntityWizard } from "./domain-entity.wizard";
import { runDomainPackageWizard } from "./domain-package.wizard";

export async function runDomainMenu(targetDirectory: string): Promise<void> {
  for (;;) {
    const choice = await promptSelect({
      message: "Domain",
      options: [
        { value: "domain-package", label: "Domain package" },
        { value: "domain-entity", label: "Domain entity" },
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
  }
}
