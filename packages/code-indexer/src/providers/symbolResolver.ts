/**
 * Symbol resolver for resolving imported symbols from external libraries
 */

import { readFile } from "fs/promises";
import { resolve, dirname, join } from "path";
import { pathToFileURL } from "url";
import type { SymbolEntry } from "../symbolIndex.ts";
import type { LSPClient } from "@internal/lsp-client";
import { existsSync } from "fs";
import { errorLog } from "../../../../src/utils/debugLog.ts";

/**
 * Import information extracted from source file
 */
export interface ImportInfo {
  source: string; // e.g., "neverthrow"
  specifiers: ImportSpecifier[];
  isTypeOnly?: boolean;
}

export interface ImportSpecifier {
  imported: string; // Name in the source module
  local: string; // Local alias (or same as imported if no alias)
  isDefault?: boolean;
  isNamespace?: boolean;
}

/**
 * Resolution result for a symbol
 */
export interface SymbolResolution {
  symbol: SymbolEntry;
  sourceModule: string;
  resolvedPath: string;
}

/**
 * Parse import statements from TypeScript source code
 */
export function parseImports(sourceCode: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // Note: These patterns are for reference only, actual parsing is done below
  // const patterns = [
  //   // import { ok, Ok, Err } from 'neverthrow'
  //   /import\s+(?:type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
  //   // import * as Result from 'neverthrow'
  //   /import\s+(?:type\s+)?\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
  //   // import ok from 'neverthrow'
  //   /import\s+(?:type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/g,
  //   // import ok, { Ok, Err } from 'neverthrow'
  //   /import\s+(?:type\s+)?(\w+)\s*,\s*{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
  // ];

  // Parse named imports
  const namedImportRegex =
    /import\s+(type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = namedImportRegex.exec(sourceCode)) !== null) {
    const isTypeOnly = !!match[1];
    const specifiersStr = match[2];
    const source = match[3];

    const specifiers = parseSpecifiers(specifiersStr);
    imports.push({
      source,
      specifiers,
      isTypeOnly,
    });
  }

  // Parse namespace imports
  const namespaceImportRegex =
    /import\s+(type\s+)?\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  sourceCode.replace(
    namespaceImportRegex,
    (fullMatch, typeKeyword, name, source) => {
      imports.push({
        source,
        specifiers: [
          {
            imported: "*",
            local: name,
            isNamespace: true,
          },
        ],
        isTypeOnly: !!typeKeyword,
      });
      return fullMatch;
    },
  );

  // Parse default imports
  const defaultImportRegex =
    /import\s+(type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  sourceCode.replace(
    defaultImportRegex,
    (fullMatch, typeKeyword, name, source) => {
      // Skip if this is part of a combined import (has comma after)
      if (fullMatch.includes(",")) return fullMatch;

      imports.push({
        source,
        specifiers: [
          {
            imported: "default",
            local: name,
            isDefault: true,
          },
        ],
        isTypeOnly: !!typeKeyword,
      });
      return fullMatch;
    },
  );

  // Parse combined default and named imports
  const combinedImportRegex =
    /import\s+(type\s+)?(\w+)\s*,\s*{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
  sourceCode.replace(
    combinedImportRegex,
    (fullMatch, typeKeyword, defaultName, namedSpecifiers, source) => {
      const specifiers: ImportSpecifier[] = [
        {
          imported: "default",
          local: defaultName,
          isDefault: true,
        },
        ...parseSpecifiers(namedSpecifiers),
      ];

      imports.push({
        source,
        specifiers,
        isTypeOnly: !!typeKeyword,
      });
      return fullMatch;
    },
  );

  return imports;
}

/**
 * Parse import specifiers from a string like "ok, Ok as OkType, Err"
 */
function parseSpecifiers(specifiersStr: string): ImportSpecifier[] {
  const specifiers: ImportSpecifier[] = [];
  const parts = specifiersStr.split(",");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check for "as" alias
    const asMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/);
    if (asMatch) {
      specifiers.push({
        imported: asMatch[1],
        local: asMatch[2],
      });
    } else {
      // No alias, imported name is same as local
      const name = trimmed.match(/^(\w+)$/)?.[1];
      if (name) {
        specifiers.push({
          imported: name,
          local: name,
        });
      }
    }
  }

  return specifiers;
}

/**
 * Resolve module path from import source
 */
export function resolveModulePath(
  importSource: string,
  fromFile: string,
  projectRoot: string,
): string | null {
  // Handle relative imports
  if (importSource.startsWith(".")) {
    const fromDir = dirname(fromFile);
    const resolved = resolve(fromDir, importSource);

    // Try with different extensions
    const extensions = [".ts", ".tsx", ".d.ts", ".js", ".jsx", ".mjs"];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (existsSync(withExt)) {
        return withExt;
      }
    }

    // Try as directory with index file
    for (const indexName of ["index", "main"]) {
      for (const ext of extensions) {
        const indexPath = join(resolved, `${indexName}${ext}`);
        if (existsSync(indexPath)) {
          return indexPath;
        }
      }
    }

    return null;
  }

  // Handle node_modules imports
  const nodeModulesPath = join(projectRoot, "node_modules", importSource);

  // Check if it's a directory with package.json
  const packageJsonPath = join(nodeModulesPath, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(
        require("fs").readFileSync(packageJsonPath, "utf-8"),
      );

      // Try to find the types entry point
      const typesEntry = packageJson.types || packageJson.typings;
      if (typesEntry) {
        const typesPath = join(nodeModulesPath, typesEntry);
        if (existsSync(typesPath)) {
          return typesPath;
        }
      }

      // Try main entry point
      const mainEntry = packageJson.main || "index.js";
      const mainPath = join(nodeModulesPath, mainEntry);

      // Look for corresponding .d.ts file
      const dtsPath = mainPath.replace(/\.(js|mjs|cjs)$/, ".d.ts");
      if (existsSync(dtsPath)) {
        return dtsPath;
      }
    } catch (error) {
      errorLog(`Failed to parse package.json for ${importSource}:`, error);
    }
  }

  // Try @types package
  const typesPackagePath = join(
    projectRoot,
    "node_modules",
    "@types",
    importSource,
  );
  const typesIndexPath = join(typesPackagePath, "index.d.ts");
  if (existsSync(typesIndexPath)) {
    return typesIndexPath;
  }

  return null;
}

/**
 * Resolve a symbol from imports in a file
 */
export async function resolveSymbolFromImports(
  symbolName: string,
  filePath: string,
  projectRoot: string,
  client: LSPClient,
): Promise<SymbolResolution | null> {
  try {
    const sourceCode = await readFile(filePath, "utf-8");
    const imports = parseImports(sourceCode);

    // Find the import that contains this symbol
    for (const importInfo of imports) {
      const specifier = importInfo.specifiers.find(
        (spec) => spec.local === symbolName,
      );

      if (specifier) {
        // Resolve the module path
        const modulePath = resolveModulePath(
          importInfo.source,
          filePath,
          projectRoot,
        );

        if (modulePath) {
          // Get symbols from the resolved module
          const moduleUri = pathToFileURL(modulePath).toString();
          const documentSymbols = await client.getDocumentSymbols(moduleUri);

          if (Array.isArray(documentSymbols)) {
            // Find the exported symbol
            const targetName = specifier.isDefault
              ? "default"
              : specifier.imported;
            const symbol = findSymbolByName(documentSymbols, targetName);

            if (symbol) {
              return {
                symbol: convertToSymbolEntry(symbol, moduleUri),
                sourceModule: importInfo.source,
                resolvedPath: modulePath,
              };
            }
          }
        }
      }
    }

    return null;
  } catch (error) {
    errorLog(
      `Failed to resolve symbol ${symbolName} from ${filePath}:`,
      error,
    );
    return null;
  }
}

/**
 * Find a symbol by name in document symbols
 */
function findSymbolByName(symbols: any[], name: string): any {
  for (const symbol of symbols) {
    if (symbol.name === name) {
      return symbol;
    }

    // Search in children recursively
    if (symbol.children) {
      const found = findSymbolByName(symbol.children, name);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Convert LSP DocumentSymbol to SymbolEntry
 */
function convertToSymbolEntry(symbol: any, uri: string): SymbolEntry {
  const entry: SymbolEntry = {
    name: symbol.name,
    kind: symbol.kind,
    location: {
      uri,
      range: symbol.range || symbol.location?.range,
    },
    detail: symbol.detail,
    deprecated: symbol.deprecated,
  };

  if (symbol.children && symbol.children.length > 0) {
    entry.children = symbol.children.map((child: any) =>
      convertToSymbolEntry(child, uri),
    );
  }

  return entry;
}

/**
 * Get all available symbols from external libraries for a file
 */
export async function getAvailableExternalSymbols(
  filePath: string,
  projectRoot: string,
): Promise<Map<string, SymbolResolution>> {
  const availableSymbols = new Map<string, SymbolResolution>();

  try {
    const sourceCode = await readFile(filePath, "utf-8");
    const imports = parseImports(sourceCode);

    for (const importInfo of imports) {
      const modulePath = resolveModulePath(
        importInfo.source,
        filePath,
        projectRoot,
      );

      if (modulePath) {
        // Store resolution info for each imported symbol
        for (const specifier of importInfo.specifiers) {
          // Create a placeholder resolution
          // In real usage, this would be populated with actual symbol data
          availableSymbols.set(specifier.local, {
            symbol: {
              name: specifier.imported,
              kind: 13, // Variable kind as default
              location: {
                uri: pathToFileURL(modulePath).toString(),
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 0, character: 0 },
                },
              },
            },
            sourceModule: importInfo.source,
            resolvedPath: modulePath,
          });
        }
      }
    }

    return availableSymbols;
  } catch (error) {
    errorLog(
      `Failed to get available external symbols from ${filePath}:`,
      error,
    );
    return availableSymbols;
  }
}
