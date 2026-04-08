import { promptSelect } from "../../prompts";
import { runUiPackageWizard } from "./ui-package.wizard";

export async function runUiMenu(targetDirectory: string): Promise<void> {
  for (;;) {
    const choice = await promptSelect({
      message: "UI",
      options: [
        { value: "ui-package", label: "UI package" },
        { value: "back", label: "Back" },
      ],
    });

    if (choice === "back") {
      return;
    }

    if (choice === "ui-package") {
      await runUiPackageWizard({ workspaceRoot: targetDirectory });
    }
  }
}
