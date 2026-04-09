import { promptSelect } from "../../prompts";
import { runCompositionPackageWizard } from "./composition-package.wizard";

export async function runCompositionMenu(targetDirectory: string): Promise<void> {
  for (;;) {
    const choice = await promptSelect({
      message: "Composition",
      options: [
        { value: "composition-package", label: "Composition package" },
        { value: "back", label: "Back" },
      ],
    });

    if (choice === "back") {
      return;
    }

    if (choice === "composition-package") {
      await runCompositionPackageWizard({ workspaceRoot: targetDirectory });
    }
  }
}
