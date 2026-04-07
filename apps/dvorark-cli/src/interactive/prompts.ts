/**
 * Thin wrappers around @clack/prompts so cancellation is handled in one place.
 *
 * **Ctrl+C vs Escape:** In @clack/core, both `\x03` and `escape` map to the same `cancel`
 * action, and `updateSettings({ aliases })` cannot override existing aliases. So a global
 * listener cannot treat Esc as "back" and Ctrl+C as "exit" without replacing Clack.
 */
import { isCancel, multiselect, select, text } from "@clack/prompts";

import { exitCliOnInterrupt } from "./exit-cli-on-interrupt";

export async function promptText(options: Parameters<typeof text>[0]): Promise<string> {
  const result = await text(options);
  if (isCancel(result)) {
    exitCliOnInterrupt();
  }
  // Clack may resolve with `undefined` on empty submit in some cases; callers expect a string.
  return typeof result === "string" ? result : "";
}

export async function promptSelect<Value>(
  options: Parameters<typeof select<Value>>[0]
): Promise<Value> {
  const result = await select(options);
  if (isCancel(result)) {
    exitCliOnInterrupt();
  }
  return result;
}

export async function promptMultiselect<Value>(
  options: Parameters<typeof multiselect<Value>>[0]
): Promise<Value[]> {
  const result = await multiselect(options);
  if (isCancel(result)) {
    exitCliOnInterrupt();
  }
  return result;
}
