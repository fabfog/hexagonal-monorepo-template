const path = require("path");

/** Monorepo root (two levels up from this file: plop/lib -> plop -> repo). */
function getRepoRoot() {
  return path.join(__dirname, "..", "..");
}

function toKebabCase(value) {
  return String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function toPascalCase(value) {
  return String(value)
    .trim()
    .split(/[\s\-_/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/** Lowercases the first character only (preserves inner capitals, e.g. FaiCose -> faiCose). */
function lowerFirst(value) {
  const s = String(value).trim();
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** camelCase from arbitrary token (normalizes segments first). E.g. DocumentEditor -> documentEditor */
function toCamelCase(value) {
  return lowerFirst(toPascalCase(value));
}

function toConstantCase(value) {
  return toKebabCase(value).toUpperCase().replace(/-/g, "_");
}

/**
 * Minimal parser for `export interface Name { method(...): T; }` method lines (single-line signatures).
 * @param {string} source
 * @param {string} interfaceName
 * @returns {{ name: string, params: string, returnType: string }[]}
 */
function parseInterfaceMethods(source, interfaceName) {
  const ifaceDecl = `export interface ${interfaceName}`;
  const start = source.indexOf(ifaceDecl);
  if (start === -1) {
    throw new Error(`Interface ${interfaceName} not found in port file`);
  }
  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) {
    throw new Error(`Cannot find body for interface ${interfaceName}`);
  }
  let braceDepth = 1;
  let i = braceStart + 1;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    if (braceDepth === 0) break;
  }
  const body = source.slice(braceStart + 1, i);

  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"));

  const methods = [];
  for (const line of lines) {
    const match = line.match(/^(\w+)\(([^)]*)\):\s*([^;{]+);?$/);
    if (!match) continue;
    const [, name, params, returnType] = match;
    methods.push({
      name,
      params: params.trim(),
      returnType: returnType.trim(),
    });
  }
  return methods;
}

module.exports = {
  getRepoRoot,
  toKebabCase,
  toPascalCase,
  lowerFirst,
  toCamelCase,
  toConstantCase,
  parseInterfaceMethods,
};
