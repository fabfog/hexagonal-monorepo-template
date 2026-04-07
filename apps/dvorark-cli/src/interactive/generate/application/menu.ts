import { promptSelect } from "../../prompts";
import { runApplicationPackageWizard } from "./application-package.wizard";

export async function runApplicationMenu(targetDirectory: string): Promise<void> {
  for (;;) {
    const choice = await promptSelect({
      message: "Application",
      options: [
        { value: "application-package", label: "Application package" },
        { value: "back", label: "Back" },
      ],
    });

    if (choice === "back") {
      return;
    }

    if (choice === "application-package") {
      await runApplicationPackageWizard({ workspaceRoot: targetDirectory });
    }
  }
}
