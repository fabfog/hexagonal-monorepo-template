import { EMPTY_BARREL_EXPORT_PATTERN } from "./constants";

/**
 * Appends a barrel `export * from '...'` line, stripping empty placeholder exports if present.
 */
export function mergeBarrelExport(
  existing: string | null,
  exportLine: string,
  emptyBarrelPattern: RegExp = EMPTY_BARREL_EXPORT_PATTERN
): string {
  if (!existing) {
    return `${exportLine}\n`;
  }
  const cleaned = existing.replace(emptyBarrelPattern, "").trimEnd();
  if (cleaned.includes(exportLine)) {
    return `${cleaned}\n`;
  }
  return cleaned.length > 0 ? `${cleaned}\n${exportLine}\n` : `${exportLine}\n`;
}
