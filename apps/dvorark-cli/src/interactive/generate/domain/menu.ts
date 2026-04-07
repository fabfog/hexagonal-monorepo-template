import { cancel, isCancel, select } from "@clack/prompts";

import { runDomainPackageWizard } from "./domain-package.wizard";

export async function runDomainMenu(targetDirectory: string): Promise<void> {
  for (;;) {
    const choice = await select({
      message: "Domain",
      options: [
        { value: "domain-package", label: "Domain package" },
        { value: "back", label: "Back" },
      ],
    });

    if (isCancel(choice)) {
      cancel("Cancelled.");
      return;
    }

    if (choice === "back") {
      return;
    }

    if (choice === "domain-package") {
      await runDomainPackageWizard({ workspaceRoot: targetDirectory });
    }
  }
}
