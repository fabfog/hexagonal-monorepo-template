import { cancel } from "@clack/prompts";

/**
 * After Clack reports cancellation (e.g. Ctrl+C, Escape), terminate the CLI process.
 * Use instead of `cancel(); return` so nested menus do not resume.
 */
export function exitCliOnInterrupt(): never {
  cancel("Exit signal received. Goodbye!");
  process.exit(0);
}
