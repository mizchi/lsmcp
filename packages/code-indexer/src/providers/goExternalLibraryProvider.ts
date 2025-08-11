/**
 * Go external library provider for indexing Go modules
 */

import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import type { LSPClient } from "@lsmcp/lsp-client";
import type { SymbolEntry } from "../symbolIndex.ts";

interface GoModule {
  module: string;
  go?: string;
  require?: GoRequire[];
  replace?: GoReplace[];
}

interface GoRequire {
  path: string;
  version: string;
  indirect?: boolean;
}

interface GoReplace {
  old: string;
  new: string;
}

/**
 * Parse go.mod file to extract module dependencies
 */
export async function parseGoMod(rootPath: string): Promise<GoModule | null> {
  const goModPath = join(rootPath, "go.mod");

  if (!existsSync(goModPath)) {
    return null;
  }

  try {
    const content = await readFile(goModPath, "utf-8");
    const lines = content.split("\n");

    const module: GoModule = {
      module: "",
      require: [],
      replace: [],
    };

    let inRequireBlock = false;
    let inReplaceBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("//")) {
        continue;
      }

      // Module declaration
      if (trimmed.startsWith("module ")) {
        module.module = trimmed.substring(7).trim();
        continue;
      }

      // Go version
      if (trimmed.startsWith("go ")) {
        module.go = trimmed.substring(3).trim();
        continue;
      }

      // Require block start
      if (trimmed === "require (") {
        inRequireBlock = true;
        continue;
      }

      // Replace block start
      if (trimmed === "replace (") {
        inReplaceBlock = true;
        continue;
      }

      // Block end
      if (trimmed === ")") {
        inRequireBlock = false;
        inReplaceBlock = false;
        continue;
      }

      // Parse require entries
      if (inRequireBlock) {
        const match = trimmed.match(
          /^([^\s]+)\s+([^\s]+)(\s+\/\/\s+indirect)?/,
        );
        if (match) {
          module.require!.push({
            path: match[1],
            version: match[2],
            indirect: !!match[3],
          });
        }
      }

      // Parse single-line require
      if (trimmed.startsWith("require ")) {
        const match = trimmed.match(
          /^require\s+([^\s]+)\s+([^\s]+)(\s+\/\/\s+indirect)?/,
        );
        if (match) {
          module.require!.push({
            path: match[1],
            version: match[2],
            indirect: !!match[3],
          });
        }
      }

      // Parse replace entries
      if (inReplaceBlock) {
        const match = trimmed.match(/^([^\s]+)\s+=>\s+([^\s]+)/);
        if (match) {
          module.replace!.push({
            old: match[1],
            new: match[2],
          });
        }
      }
    }

    return module;
  } catch (error) {
    console.error("Failed to parse go.mod:", error);
    return null;
  }
}

/**
 * Parse go.sum to get exact versions and checksums
 */
export async function parseGoSum(
  rootPath: string,
): Promise<Map<string, string>> {
  const goSumPath = join(rootPath, "go.sum");
  const versions = new Map<string, string>();

  if (!existsSync(goSumPath)) {
    return versions;
  }

  try {
    const content = await readFile(goSumPath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Format: module version hash
      const parts = trimmed.split(" ");
      if (parts.length >= 2) {
        versions.set(parts[0], parts[1]);
      }
    }

    return versions;
  } catch (error) {
    console.error("Failed to parse go.sum:", error);
    return versions;
  }
}

/**
 * Get Go module cache path
 * Go modules are cached in $GOPATH/pkg/mod or ~/go/pkg/mod
 */
export function getGoModCachePath(): string {
  const goPath = process.env.GOPATH;
  if (goPath) {
    return join(goPath, "pkg", "mod");
  }

  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    return join(home, "go", "pkg", "mod");
  }

  return "";
}

/**
 * Convert module path and version to cache directory name
 * Go encodes versions in the cache: github.com/user/repo@v1.2.3
 */
export function getModuleCachePath(
  modulePath: string,
  version: string,
): string {
  const modCachePath = getGoModCachePath();
  if (!modCachePath) {
    return "";
  }

  // Replace uppercase with !lowercase (Go's encoding)
  const encodedPath = modulePath.replace(
    /([A-Z])/g,
    (match) => "!" + match.toLowerCase(),
  );

  return join(modCachePath, `${encodedPath}@${version}`);
}

/**
 * Parse Go import statements
 */
export function parseGoImports(sourceCode: string): GoImport[] {
  const imports: GoImport[] = [];

  // Match single import: import "package"
  const singleImportRegex = /^\s*import\s+"([^"]+)"/gm;

  let match;
  while ((match = singleImportRegex.exec(sourceCode)) !== null) {
    imports.push({
      path: match[1],
      alias: undefined,
    });
  }

  // Match aliased import: import alias "package"
  const aliasedImportRegex =
    /^\s*import\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+"([^"]+)"/gm;

  while ((match = aliasedImportRegex.exec(sourceCode)) !== null) {
    imports.push({
      path: match[2],
      alias: match[1],
    });
  }

  // Match import block
  const blockImportRegex = /import\s*\(([\s\S]*?)\)/g;

  while ((match = blockImportRegex.exec(sourceCode)) !== null) {
    const blockContent = match[1];
    const lines = blockContent.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//")) {
        continue;
      }

      // Check for aliased import in block
      const aliasMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+"([^"]+)"/);
      if (aliasMatch) {
        imports.push({
          path: aliasMatch[2],
          alias: aliasMatch[1],
        });
        continue;
      }

      // Check for dot import
      if (trimmed.startsWith('. "')) {
        const pathMatch = trimmed.match(/\.\s+"([^"]+)"/);
        if (pathMatch) {
          imports.push({
            path: pathMatch[1],
            alias: ".",
          });
        }
        continue;
      }

      // Check for regular import in block
      const pathMatch = trimmed.match(/"([^"]+)"/);
      if (pathMatch) {
        imports.push({
          path: pathMatch[1],
          alias: undefined,
        });
      }
    }
  }

  return imports;
}

interface GoImport {
  path: string;
  alias?: string;
}

/**
 * Classify Go import as standard library, internal, or external
 */
export function classifyGoImport(
  importPath: string,
  currentModule: string,
): ImportType {
  // Standard library packages (no dots in the path, except for subpackages)
  if (!importPath.includes("/") || importPath.startsWith("internal/")) {
    return "stdlib";
  }

  // Check common standard library packages with slashes
  const stdlibPackages = [
    "archive/",
    "compress/",
    "container/",
    "crypto/",
    "database/",
    "debug/",
    "embed/",
    "encoding/",
    "go/",
    "hash/",
    "html/",
    "image/",
    "index/",
    "io/",
    "log/",
    "math/",
    "mime/",
    "net/",
    "os/",
    "path/",
    "reflect/",
    "regexp/",
    "runtime/",
    "sort/",
    "strings/",
    "sync/",
    "testing/",
    "text/",
    "time/",
    "unicode/",
  ];

  if (stdlibPackages.some((pkg) => importPath.startsWith(pkg))) {
    return "stdlib";
  }

  // Internal package (part of current module)
  if (currentModule && importPath.startsWith(currentModule)) {
    return "internal";
  }

  // External package
  return "external";
}

type ImportType = "stdlib" | "internal" | "external";

/**
 * Get symbols from a Go module using gopls
 *
 * gopls automatically indexes all imported modules, making symbols
 * available through standard LSP operations
 */
export async function getGoModuleSymbols(
  modulePath: string,
  client: LSPClient,
): Promise<SymbolEntry[]> {
  try {
    // gopls provides excellent workspace-wide symbol search
    // Search for symbols from the specific module
    const symbols = await client.getWorkspaceSymbols(modulePath);

    // Convert to our format and mark as external
    return symbols.map((symbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      location: symbol.location,
      containerName: symbol.containerName,
      isExternal: true,
      sourceLibrary: modulePath,
    }));
  } catch (error) {
    console.error(`Failed to get symbols for module ${modulePath}:`, error);
    return [];
  }
}

/**
 * Example: Get symbols from popular Go packages
 */
export async function exampleGoPackageIndexing(
  rootPath: string,
  client: LSPClient,
): Promise<void> {
  const goMod = await parseGoMod(rootPath);
  if (!goMod) {
    console.log("No go.mod found");
    return;
  }

  console.log(`Project module: ${goMod.module}`);
  console.log(`Dependencies: ${goMod.require?.length || 0}`);

  // Look for common packages
  const commonPackages = [
    "github.com/gin-gonic/gin",
    "github.com/gorilla/mux",
    "github.com/stretchr/testify",
    "github.com/spf13/cobra",
    "github.com/sirupsen/logrus",
  ];

  for (const pkg of commonPackages) {
    const dep = goMod.require?.find((r) => r.path === pkg);
    if (dep) {
      console.log(`\nIndexing ${pkg}@${dep.version}...`);

      const symbols = await getGoModuleSymbols(pkg, client);
      console.log(`Found ${symbols.length} symbols`);

      // Show some example symbols
      const functionSymbols = symbols.filter((s) => s.kind === 12); // Function kind
      const typeSymbols = symbols.filter((s) => s.kind === 5); // Class/Struct kind

      console.log(`  Functions: ${functionSymbols.length}`);
      console.log(`  Types: ${typeSymbols.length}`);

      // Show first few symbols
      for (const symbol of symbols.slice(0, 5)) {
        console.log(`  - ${symbol.name}`);
      }
    }
  }
}

/**
 * Check if gopls can handle external library indexing
 *
 * gopls has excellent built-in support for module dependency analysis
 */
export function canGoplsHandleExternals(client: LSPClient): boolean {
  // Check if client is gopls
  if (client.languageId !== "go") {
    return false;
  }

  // gopls supports:
  // - workspace/symbol with module-wide search
  // - textDocument/definition to navigate to dependency sources
  // - Automatic indexing of all modules in go.mod
  return true;
}

/**
 * Get all external Go modules from a project
 */
export async function getAllGoModules(rootPath: string): Promise<GoRequire[]> {
  const goMod = await parseGoMod(rootPath);
  if (!goMod || !goMod.require) {
    return [];
  }

  // Filter out indirect dependencies if needed
  return goMod.require.filter((r) => !r.indirect);
}
