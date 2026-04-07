import { promptSelect } from "../../prompts";
import { runDomainPackageWizard } from "./domain-package.wizard";

export async function runDomainMenu(targetDirectory: string): Promise<void> {
  for (;;) {
    const choice = await promptSelect({
      message: "Domain",
      options: [
        { value: "domain-package", label: "Domain package" },
        { value: "back", label: "Back" },
      ],
    });

    if (choice === "back") {
      return;
    }

    if (choice === "domain-package") {
      await runDomainPackageWizard({ workspaceRoot: targetDirectory });
    }
  }
}
