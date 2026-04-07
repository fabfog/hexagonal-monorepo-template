import { cancel, isCancel, select } from "@clack/prompts";

import { runApplicationMenu } from "./application/menu";
import { runDomainMenu } from "./domain/menu";

export async function runGenerateMenu(targetDirectory: string): Promise<void> {
  for (;;) {
    const choice = await select({
      message: "Generate",
      options: [
        { value: "domain", label: "Domain" },
        { value: "application", label: "Application" },
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

    if (choice === "domain") {
      await runDomainMenu(targetDirectory);
    }

    if (choice === "application") {
      await runApplicationMenu(targetDirectory);
    }
  }
}
