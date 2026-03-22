// Vitest config for the whole monorepo
import { defineBaseVitestConfig } from "@repo/config-vitest";

export default defineBaseVitestConfig({
  test: {
    include: ["packages/**/*.test.ts", "plop/**/*.test.ts"],
  },
});
