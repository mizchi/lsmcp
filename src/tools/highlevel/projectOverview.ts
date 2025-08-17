/**
 * Project overview tool for quick project analysis
 */

import { z } from "zod";
import type { McpToolDef, McpContext } from "@internal/types";
import {
  getOrCreateIndex,
  getIndexStats,
  querySymbols,
  updateIndexIncremental,
  indexFiles,
} from "@internal/code-indexer";
// Remove getLSPClient - no longer needed
import { loadIndexConfig } from "@internal/code-indexer";
import { glob } from "gitaware-glob";
import { debugLogWithPrefix } from "../../utils/debugLog.ts";
import { SymbolKind } from "vscode-languageserver-types";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { getProjectDiagnostics } from "./getDiagnostics.ts";

const getProjectOverviewSchema = z.object({
  root: z.string().describe("Root directory for the project").optional(),
});

interface ProjectInfo {
  name?: string;
  version?: string;
  description?: string;
  type?: string;
  dependencies?: string[];
}

/**
 * Detect project type from dependencies
 */
function detectProjectType(packageJson: any): string {
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (deps.react || deps["react-dom"]) return "React Application";
  if (deps.vue) return "Vue Application";
  if (deps.angular || deps["@angular/core"]) return "Angular Application";
  if (deps.next) return "Next.js Application";
  if (deps.express || deps.fastify || deps.koa) return "Node.js Server";
  if (deps.electron) return "Electron Application";
  if (packageJson.name?.startsWith("@") && packageJson.name?.includes("/"))
    return "NPM Package";

  return "JavaScript/TypeScript Project";
}

/**
 * Get project info from package.json
 */
async function getProjectInfo(rootPath: string): Promise<ProjectInfo> {
  try {
    const packageJsonPath = path.join(rootPath, "package.json");
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);

    const dependencies = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }).slice(0, 10); // Limit to 10 most important

    return {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      type: detectProjectType(packageJson),
      dependencies,
    };
  } catch {
    // No package.json or error reading it
    return {};
  }
}

/**
 * Get directory structure from indexed files with file counts
 */
function getDirectoryStructure(
  rootPath: string,
  symbols: any[],
): Map<string, number> {
  const dirFiles = new Map<string, Set<string>>();

  for (const symbol of symbols) {
    if (symbol.location?.uri) {
      const filePath = fileURLToPath(symbol.location.uri);
      const relativePath = path.relative(rootPath, filePath);
      const dir = path.dirname(relativePath);

      // Track all directory levels up to depth 3
      const parts = dir.split(path.sep).filter((p) => p && p !== ".");
      for (let i = 0; i < Math.min(parts.length, 3); i++) {
        const dirPath = parts.slice(0, i + 1).join("/");
        if (!dirFiles.has(dirPath)) {
          dirFiles.set(dirPath, new Set());
        }
        dirFiles.get(dirPath)!.add(filePath);
      }
    }
  }

  // Convert to file counts and sort by depth and name
  const dirCounts = new Map<string, number>();
  for (const [dir, files] of dirFiles) {
    dirCounts.set(dir, files.size);
  }

  // Sort by depth first, then alphabetically
  return new Map(
    [...dirCounts.entries()].sort((a, b) => {
      const depthA = a[0].split("/").length;
      const depthB = b[0].split("/").length;
      if (depthA !== depthB) return depthA - depthB;
      return a[0].localeCompare(b[0]);
    }),
  );
}

/**
 * Ensure index exists but don't create it if missing (lightweight check)
 * Returns true if index exists, false otherwise
 */
function checkIndexExists(rootPath: string): boolean {
  const stats = getIndexStats(rootPath);
  return stats.totalFiles > 0;
}

export const getProjectOverviewTool: McpToolDef<
  typeof getProjectOverviewSchema
> = {
  name: "get_project_overview",
  description:
    "Get a quick overview of the project structure, key components, and statistics. " +
    "This tool automatically creates an index if needed and provides a concise summary.",
  schema: getProjectOverviewSchema,
  execute: async ({ root }, context?: McpContext) => {
    const rootPath = root || process.cwd();

    // Check if index exists
    const indexExists = checkIndexExists(rootPath);

    if (!indexExists) {
      // First time: create index and do full indexing
      debugLogWithPrefix(
        "get_project_overview",
        "No index found, creating and performing initial full index",
      );

      // Create index instance
      const index = getOrCreateIndex(rootPath, context);
      if (index) {
        try {
          // Perform full indexing on first run
          const startTime = Date.now();

          // Find all TypeScript/JavaScript files
          const patterns = [
            "**/*.ts",
            "**/*.tsx",
            "**/*.js",
            "**/*.jsx",
            "**/*.mjs",
            "**/*.mts",
          ];

          const files: string[] = [];
          for (const pattern of patterns) {
            for await (const file of glob(pattern, { cwd: rootPath })) {
              if (typeof file === "string") {
                files.push(file);
              } else if (file && typeof file === "object" && "name" in file) {
                files.push((file as any).name);
              }
            }
          }

          debugLogWithPrefix(
            "get_project_overview",
            `Found ${files.length} files to index`,
          );

          if (files.length > 0) {
            await indexFiles(rootPath, files, {
              concurrency: 5,
              context,
            });
          }

          const elapsed = Date.now() - startTime;
          debugLogWithPrefix(
            "get_project_overview",
            `Initial indexing completed in ${elapsed}ms`,
          );
        } catch (error) {
          debugLogWithPrefix(
            "get_project_overview",
            `Initial indexing failed: ${error}`,
          );
        }
      }
    } else {
      // Index exists, run incremental update for fast refresh
      try {
        debugLogWithPrefix(
          "get_project_overview",
          "Index exists, running fast incremental update",
        );
        const startTime = Date.now();
        const updateResult = await updateIndexIncremental(rootPath, context);
        const elapsed = Date.now() - startTime;

        if (updateResult.success) {
          debugLogWithPrefix(
            "get_project_overview",
            `Incremental update completed in ${elapsed}ms: ${updateResult.updated.length} files updated, ${updateResult.removed.length} files removed`,
          );
        } else if (updateResult.errors.length > 0) {
          debugLogWithPrefix(
            "get_project_overview",
            `Incremental update errors: ${updateResult.errors.join(", ")}`,
          );
        }
      } catch (error) {
        // Silently continue if incremental update fails
        debugLogWithPrefix(
          "get_project_overview",
          `Incremental update failed: ${error}`,
        );
      }
    }

    // Get project info
    const projectInfo = await getProjectInfo(rootPath);

    // Get statistics
    const stats = getIndexStats(rootPath);

    // Get diagnostics using internal function
    let errorCount = 0;
    let warningCount = 0;

    // Only get diagnostics if LSP client is available
    if (context?.lspClient) {
      try {
        const diagnostics = await getProjectDiagnostics(
          { root: rootPath },
          context.lspClient,
          context,
        );
        errorCount = diagnostics.errorCount;
        warningCount = diagnostics.warningCount;
      } catch (error) {
        // Silently ignore diagnostic errors
        debugLogWithPrefix(
          "get_project_overview",
          `Failed to get diagnostics: ${error}`,
        );
      }
    }

    // Get all symbols once and filter in memory (much faster than multiple queries)
    const allSymbols = querySymbols(rootPath, {});

    // Check if Variables/Constants are filtered out by configuration
    const config = loadIndexConfig(rootPath);
    const isVariableFiltered =
      config?.symbolFilter?.excludeKinds?.includes("Variable");
    const isConstantFiltered =
      config?.symbolFilter?.excludeKinds?.includes("Constant");

    // Filter symbols by kind in memory (avoid multiple DB queries)
    const functions = allSymbols.filter((s) => s.kind === SymbolKind.Function);
    const methods = allSymbols.filter((s) => s.kind === SymbolKind.Method);
    const classes = allSymbols.filter((s) => s.kind === SymbolKind.Class);
    const interfaces = allSymbols.filter(
      (s) => s.kind === SymbolKind.Interface,
    );
    const enums = allSymbols.filter((s) => s.kind === SymbolKind.Enum);
    const constants = allSymbols.filter((s) => s.kind === SymbolKind.Constant);
    const variables = allSymbols.filter((s) => s.kind === SymbolKind.Variable);
    const properties = allSymbols.filter((s) => s.kind === SymbolKind.Property);

    // Get directory structure with file counts
    const directories = getDirectoryStructure(rootPath, allSymbols);

    // Build overview
    let output = "## Project Overview\n\n";

    // Project info
    if (projectInfo.name) {
      output += `**Project:** ${projectInfo.name}`;
      if (projectInfo.version) output += ` v${projectInfo.version}`;
      output += "\n";
      if (projectInfo.description) output += `${projectInfo.description}\n`;
      if (projectInfo.type) output += `**Type:** ${projectInfo.type}\n`;
      output += "\n";
    }

    // Statistics
    output += "### Statistics:\n";
    output += `- **Files:** ${stats.totalFiles}\n`;
    output += `- **Symbols:** ${stats.totalSymbols}\n`;
    output += `- **Indexing time:** ${stats.totalFiles > 0 ? Math.round(stats.indexingTime / 1000) : 0}s\n`;
    output += `- **Last updated:** ${stats.lastUpdated.toISOString()}\n`;

    // Detailed symbol breakdown if available
    if (stats.totalSymbols > 0) {
      output += "\n**Symbol breakdown:**\n";
      output += `  - Classes: ${classes.length}\n`;
      output += `  - Interfaces: ${interfaces.length}\n`;
      output += `  - Functions: ${functions.length}\n`;
      output += `  - Methods: ${methods.length}\n`;
      // Properties often include class fields and object properties
      if (properties.length > 0) {
        output += `  - Properties: ${properties.length}\n`;
      }
      // Note: TypeScript LSP doesn't typically return Variable/Constant kinds
      // for module-level declarations, so these counts may be 0
      if (variables.length > 0 || constants.length > 0) {
        output += `  - Variables: ${variables.length}\n`;
        output += `  - Constants: ${constants.length}\n`;
      } else if (isVariableFiltered || isConstantFiltered) {
        // Indicate if these kinds are filtered out by configuration
        const filtered = [];
        if (isVariableFiltered) filtered.push("Variables");
        if (isConstantFiltered) filtered.push("Constants");
        output += `  - *${filtered.join("/")} excluded by config*\n`;
      }
      if (enums.length > 0) output += `  - Enums: ${enums.length}\n`;
    }

    // Diagnostics section
    if (errorCount > 0 || warningCount > 0) {
      output += "\n**Diagnostics:**\n";
      output += `  - Errors: ${errorCount}\n`;
      output += `  - Warnings: ${warningCount}\n`;
    }

    // Index status and guidance
    if (stats.totalFiles === 0) {
      output += "\n⚠️ **No symbol index found**\n";
      output +=
        "The project has not been indexed yet. To enable fast symbol search:\n";
      output += "1. Run `index_symbols` tool to create the initial index\n";
      output +=
        "2. The index will be automatically updated when files change\n";
      output +=
        "\nAlternatively, `search_symbols` will auto-create the index on first use.\n";
    } else if (stats.totalSymbols === 0) {
      output += "\n⚠️ **Index exists but no symbols found**\n";
      output += "This might mean:\n";
      output += "- The file patterns don't match any source files\n";
      output += "- The LSP server doesn't support symbol indexing\n";
      output += "- Try running `index_symbols` with different file patterns\n";
    }
    output += "\n";

    // Directory structure with file counts (showing up to depth 3)
    if (directories.size > 0) {
      output += "### Structure (top 3 levels):\n```\n";
      for (const [dir, fileCount] of directories) {
        const depth = dir.split("/").length - 1;
        const indent = "  ".repeat(depth);
        const name = dir.split("/").pop();
        output += `${indent}${name}/ (${fileCount} files)\n`;
      }
      output += "```\n\n";
    }

    // Key components
    output += "### Key Components:\n\n";

    // Functions (prioritized)
    if (functions.length > 0 || methods.length > 0) {
      const allFunctions = [...functions, ...methods];

      // Categorize functions
      const exportedFunctions = allFunctions.filter((f) => !f.containerName);
      const classMethods = allFunctions.filter((f) => f.containerName);

      output += `**Functions & Methods** (${allFunctions.length} total):\n`;

      // Show exported/top-level functions first
      if (exportedFunctions.length > 0) {
        output += `\nExported Functions (showing first 10 of ${exportedFunctions.length}):\n`;
        exportedFunctions.slice(0, 10).forEach((f) => {
          const filePath = f.location
            ? path.basename(fileURLToPath(f.location.uri))
            : "";
          output += `  • ${f.name} - ${filePath}\n`;
        });
        if (exportedFunctions.length > 10) {
          output += `  ... and ${exportedFunctions.length - 10} more\n`;
        }
      }

      // Show class methods
      if (classMethods.length > 0) {
        const methodsByClass = new Map<string, any[]>();
        classMethods.forEach((m) => {
          const container = m.containerName || "Unknown";
          if (!methodsByClass.has(container)) {
            methodsByClass.set(container, []);
          }
          methodsByClass.get(container)!.push(m);
        });

        output += `\nClass Methods (showing first 5 classes):\n`;
        let shown = 0;
        for (const [className, methods] of methodsByClass) {
          if (shown >= 5) break; // Limit number of classes shown
          output += `  ${className}:\n`;
          methods.slice(0, 3).forEach((m) => {
            output += `    • ${m.name}\n`;
          });
          if (methods.length > 3) {
            output += `    ... and ${methods.length - 3} more\n`;
          }
          shown++;
        }
        if (methodsByClass.size > 5) {
          output += `  ... and ${methodsByClass.size - 5} more classes\n`;
        }
      }
      output += "\n";
    }

    // Classes (with member counts)
    if (classes.length > 0) {
      const limit = 10;
      output += `**Classes** (showing first 10 of ${classes.length}):\n`;
      classes.slice(0, limit).forEach((c) => {
        const classMethods = methods.filter((m) => m.containerName === c.name);
        const filePath = c.location
          ? path.basename(fileURLToPath(c.location.uri))
          : "";
        output += `  • ${c.name} (${classMethods.length} methods) - ${filePath}\n`;
      });
      if (classes.length > limit) {
        output += `  ... and ${classes.length - limit} more\n`;
      }
      output += "\n";
    }

    // Interfaces
    if (interfaces.length > 0) {
      const limit = 8;
      output += `**Interfaces** (showing first 8 of ${interfaces.length}):\n`;
      interfaces.slice(0, limit).forEach((i) => {
        const filePath = i.location
          ? path.basename(fileURLToPath(i.location.uri))
          : "";
        output += `  • ${i.name} - ${filePath}\n`;
      });
      if (interfaces.length > limit) {
        output += `  ... and ${interfaces.length - limit} more\n`;
      }
      output += "\n";
    }

    // Enums
    if (enums.length > 0) {
      output += `**Enums** (showing all ${enums.length}):\n`;
      enums.slice(0, 5).forEach((e) => {
        output += `  • ${e.name}\n`;
      });
      if (enums.length > 5) {
        output += `  ... and ${enums.length - 5} more\n`;
      }
      output += "\n";
    }

    // Constants & Variables summary
    if (constants.length > 0 || variables.length > 0) {
      output += `**Data**:\n`;
      if (constants.length > 0)
        output += `  • Constants: ${constants.length}\n`;
      if (variables.length > 0)
        output += `  • Variables: ${variables.length}\n`;
      output += "\n";
    }

    // Dependencies
    if (projectInfo.dependencies && projectInfo.dependencies.length > 0) {
      output += "### Dependencies:\n";
      projectInfo.dependencies.forEach((dep) => {
        output += `• ${dep}\n`;
      });
      output += "\n";
    }

    // Suggestions
    output += "### Next Steps:\n";
    if (stats.totalFiles === 0) {
      output += "1. Run `index_symbols` to build the symbol index\n";
      output +=
        "2. Use `search_symbols` to find specific symbols (will auto-index)\n";
      output += "3. Use `lsp_get_document_symbols` to explore specific files\n";
    } else {
      output += "1. Use `search_symbols` to find specific symbols\n";
      output += "2. Use `lsp_get_document_symbols` to explore specific files\n";
      output += "3. Use `lsp_find_references` to trace symbol usage\n";
      output += "4. Use `lsp_get_definitions` to navigate to definitions\n";
    }

    return output;
  },
};
