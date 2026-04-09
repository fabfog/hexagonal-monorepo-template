import path from "node:path";
import { fileURLToPath } from "node:url";
export * from "./casing.ts";
export * from "./packages.ts";
export * from "./add-port-to-application-deps.ts";
export * from "./workspace-dependency-version.ts";
const libDir = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (two levels up from this file: plop/lib -> plop -> repo). */
export function getRepoRoot(): string {
  return path.join(libDir, "..", "..");
}
