/**
 * External library provider for indexing node_modules dependencies
 * Currently supports TypeScript declarations (.d.ts files)
 */

import { join, relative } from "path";
import { readFile, stat } from "fs/promises";
import { glob } from "glob";
import { existsSync } from "fs";
import type { DocumentSymbol } from "vscode-languageserver-types";
import type { SymbolEntry, FileSymbols } from "../symbolIndex.ts";
import { pathToFileURL } from "url";
import type { LSPClient } from "@lsmcp/lsp-client";
import { withTemporaryDocument } from "@lsmcp/lsp-client";

export interface ExternalLibraryConfig {
  rootPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
  maxFiles?: number;
}

export interface LibraryInfo {
  name: string;
  version?: string;
  mainTypings?: string;
  typingsFiles: string[];
}

export interface ExternalLibraryIndexResult {
  libraries: Map<string, LibraryInfo>;
  files: FileSymbols[];
  totalSymbols: number;
  indexingTime: number;
}

/**
 * Get TypeScript declaration files from node_modules
 */
export async function getNodeModulesDeclarations(
  rootPath: string,
  config?: Partial<ExternalLibraryConfig>,
): Promise<string[]> {
  const nodeModulesPath = join(rootPath, "node_modules");

  if (!existsSync(nodeModulesPath)) {
    return [];
  }

  const defaultPatterns = [
    "node_modules/**/*.d.ts",
    "node_modules/@types/**/*.d.ts",
  ];

  const patterns = config?.includePatterns || defaultPatterns;
  const excludePatterns = config?.excludePatterns || [
    "**/node_modules/**/node_modules/**",
    "**/test/**",
    "**/tests/**",
    "**/*.test.d.ts",
    "**/*.spec.d.ts",
  ];

  const allFiles: string[] = [];
  const maxFiles = config?.maxFiles || 5000;

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: rootPath,
      absolute: true,
      ignore: excludePatterns,
      nodir: true,
      follow: false,
    });

    allFiles.push(...files);

    if (allFiles.length > maxFiles) {
      console.warn(`Reached maximum file limit (${maxFiles}), stopping scan`);
      return allFiles.slice(0, maxFiles);
    }
  }

  return allFiles;
}

/**
 * Parse package.json to extract library info
 */
async function getLibraryInfo(
  packagePath: string,
): Promise<LibraryInfo | null> {
  const packageJsonPath = join(packagePath, "package.json");

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);

    return {
      name: packageJson.name || relative("node_modules", packagePath),
      version: packageJson.version,
      mainTypings: packageJson.types || packageJson.typings,
      typingsFiles: [],
    };
  } catch (error) {
    console.error(`Failed to parse package.json at ${packageJsonPath}:`, error);
    return null;
  }
}

/**
 * Group declaration files by their library
 */
export async function groupFilesByLibrary(
  files: string[],
  rootPath: string,
): Promise<Map<string, LibraryInfo>> {
  const libraries = new Map<string, LibraryInfo>();
  const nodeModulesPath = join(rootPath, "node_modules");

  for (const file of files) {
    const relativePath = relative(nodeModulesPath, file);
    const parts = relativePath.split(/[\/\\]/);

    let libraryName: string;
    let libraryPath: string;

    if (parts[0] === "@types") {
      // @types/package-name
      libraryName = parts.slice(0, 2).join("/");
      libraryPath = join(nodeModulesPath, libraryName);
    } else if (parts[0].startsWith("@")) {
      // @scope/package-name
      libraryName = parts.slice(0, 2).join("/");
      libraryPath = join(nodeModulesPath, libraryName);
    } else {
      // regular package
      libraryName = parts[0];
      libraryPath = join(nodeModulesPath, libraryName);
    }

    if (!libraries.has(libraryName)) {
      const info = await getLibraryInfo(libraryPath);
      if (info) {
        libraries.set(libraryName, info);
      } else {
        libraries.set(libraryName, {
          name: libraryName,
          typingsFiles: [],
        });
      }
    }

    const library = libraries.get(libraryName)!;
    library.typingsFiles.push(file);
  }

  return libraries;
}

/**
 * Convert DocumentSymbol to SymbolEntry recursively
 */
function documentSymbolToEntry(
  symbol: DocumentSymbol,
  fileUri: string,
  containerName?: string,
): SymbolEntry {
  const entry: SymbolEntry = {
    name: symbol.name,
    kind: symbol.kind,
    location: {
      uri: fileUri,
      range: symbol.range,
    },
    containerName,
    deprecated: symbol.deprecated,
    detail: symbol.detail,
  };

  if (symbol.children && symbol.children.length > 0) {
    entry.children = symbol.children.map((child) =>
      documentSymbolToEntry(child, fileUri, symbol.name),
    );
  }

  return entry;
}

/**
 * Index symbols from a declaration file using LSP
 */
export async function indexDeclarationFile(
  filePath: string,
  client: LSPClient,
): Promise<FileSymbols | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const fileUri = pathToFileURL(filePath).toString();

    const symbols = await withTemporaryDocument(
      client,
      fileUri,
      content,
      async () => {
        return await client.getDocumentSymbols(fileUri);
      },
    );

    if (!symbols || !Array.isArray(symbols)) {
      return null;
    }

    const entries: SymbolEntry[] = symbols.map((symbol) =>
      documentSymbolToEntry(symbol as DocumentSymbol, fileUri),
    );

    const stats = await stat(filePath);

    return {
      uri: fileUri,
      lastModified: stats.mtimeMs,
      symbols: entries,
    };
  } catch (error) {
    console.error(`Failed to index ${filePath}:`, error);
    return null;
  }
}

/**
 * Index external libraries from node_modules
 */
export async function indexExternalLibraries(
  rootPath: string,
  client: LSPClient,
  config?: Partial<ExternalLibraryConfig>,
): Promise<ExternalLibraryIndexResult> {
  const startTime = Date.now();

  console.log("Scanning for TypeScript declaration files in node_modules...");
  const declarationFiles = await getNodeModulesDeclarations(rootPath, config);
  console.log(`Found ${declarationFiles.length} declaration files`);

  console.log("Grouping files by library...");
  const libraries = await groupFilesByLibrary(declarationFiles, rootPath);
  console.log(`Found ${libraries.size} libraries with TypeScript declarations`);

  const files: FileSymbols[] = [];
  let totalSymbols = 0;
  let processedFiles = 0;

  for (const [libraryName, libraryInfo] of libraries) {
    console.log(
      `Indexing ${libraryName} (${libraryInfo.typingsFiles.length} files)...`,
    );

    for (const filePath of libraryInfo.typingsFiles) {
      const fileSymbols = await indexDeclarationFile(filePath, client);

      if (fileSymbols) {
        files.push(fileSymbols);
        totalSymbols += fileSymbols.symbols.length;
        processedFiles++;

        if (processedFiles % 100 === 0) {
          console.log(
            `Progress: ${processedFiles}/${declarationFiles.length} files indexed`,
          );
        }
      }
    }
  }

  const indexingTime = Date.now() - startTime;

  console.log(
    `Indexing complete: ${totalSymbols} symbols from ${files.length} files in ${indexingTime}ms`,
  );

  return {
    libraries,
    files,
    totalSymbols,
    indexingTime,
  };
}

/**
 * Get available TypeScript dependencies from package.json
 */
export async function getAvailableTypescriptDependencies(
  rootPath: string,
): Promise<string[]> {
  const packageJsonPath = join(rootPath, "package.json");

  if (!existsSync(packageJsonPath)) {
    return [];
  }

  try {
    const content = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);

    const dependencies: string[] = [];

    // Collect all dependencies that might have TypeScript declarations
    const depFields = [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ];

    for (const field of depFields) {
      if (packageJson[field]) {
        dependencies.push(...Object.keys(packageJson[field]));
      }
    }

    // Filter to only those that exist in node_modules with .d.ts files
    const existingDeps = [];
    for (const dep of dependencies) {
      const depPath = join(rootPath, "node_modules", dep);
      if (existsSync(depPath)) {
        // Check if it has TypeScript declarations
        const patterns = [
          join(depPath, "**/*.d.ts"),
          join(rootPath, "node_modules", "@types", dep, "**/*.d.ts"),
        ];

        for (const pattern of patterns) {
          const files = await glob(pattern, { nodir: true });
          if (files.length > 0) {
            existingDeps.push(dep);
            break;
          }
        }
      }
    }

    return existingDeps;
  } catch (error) {
    console.error(`Failed to read package.json:`, error);
    return [];
  }
}
