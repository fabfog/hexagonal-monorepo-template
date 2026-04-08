import { promptSelect } from "../prompts";
import { runApplicationMenu } from "./application/menu";
import { runUiMenu } from "./ui/menu";
import { runDomainMenu } from "./domain/menu";

export async function runGenerateMenu(targetDirectory: string): Promise<void> {
  for (;;) {
    const choice = await promptSelect({
      message: "Generate",
      options: [
        { value: "domain", label: "Domain" },
        { value: "application", label: "Application" },
        { value: "ui", label: "UI" },
        { value: "back", label: "Back" },
      ],
    });

    if (choice === "back") {
      return;
    }

    if (choice === "domain") {
      await runDomainMenu(targetDirectory);
    }

    if (choice === "application") {
      await runApplicationMenu(targetDirectory);
    }

    if (choice === "ui") {
      await runUiMenu(targetDirectory);
    }
  }
}
