import { cancel, isCancel, select } from "@clack/prompts";

import { runApplicationPackageWizard } from "./application-package.wizard";

export async function runApplicationMenu(targetDirectory: string): Promise<void> {
  for (;;) {
    const choice = await select({
      message: "Application",
      options: [
        { value: "application-package", label: "Application package" },
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

    if (choice === "application-package") {
      await runApplicationPackageWizard({ workspaceRoot: targetDirectory });
    }
  }
}
