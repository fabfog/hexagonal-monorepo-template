import pc from "picocolors";

import { runCli } from "./cli";

runCli().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${pc.red(pc.bold("[dvorark]"))} ${message}`);
  process.exitCode = 1;
});
