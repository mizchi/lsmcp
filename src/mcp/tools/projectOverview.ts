/**
 * Project overview tool for quick project analysis
 */

import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import {
  getOrCreateIndex,
  getIndexStats,
  querySymbols,
} from "../../indexer/mcp/IndexerAdapter.ts";
import { getLSPClient } from "../../lsp/lspClient.ts";
import { loadIndexConfig } from "../../indexer/core/configLoader.ts";
import { getAdapterDefaultPattern } from "../../indexer/core/adapterDefaults.ts";
import { glob } from "gitaware-glob";
import { SymbolKind } from "vscode-languageserver-types";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

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
 * Auto-index if needed (similar to search_symbol_from_index)
 */
async function ensureIndexExists(rootPath: string): Promise<void> {
  const stats = getIndexStats(rootPath);

  if (stats.totalFiles === 0) {
    console.error(
      `[get_project_overview] No index found. Creating initial index...`,
    );

    const client = getLSPClient();
    if (!client) {
      throw new Error("LSP client not initialized");
    }

    const index = getOrCreateIndex(rootPath);
    if (!index) {
      throw new Error("Failed to create symbol index");
    }

    // Determine pattern for initial indexing
    let pattern: string;
    const config = loadIndexConfig(rootPath);

    if (config?.indexFiles && config.indexFiles.length > 0) {
      pattern = config.indexFiles.join(",");
    } else {
      pattern = getAdapterDefaultPattern("typescript");
    }

    const concurrency = config?.settings?.indexConcurrency || 5;

    // Find files to index
    const files: string[] = [];
    // Handle patterns with braces properly (e.g., **/*.{ts,tsx})
    const patterns =
      pattern.includes("{") && pattern.includes("}")
        ? [pattern]
        : pattern.split(",").map((p) => p.trim());

    for (const p of patterns) {
      for await (const file of glob(p, { cwd: rootPath })) {
        if (typeof file === "string") {
          files.push(file);
        } else if (file && typeof file === "object" && "name" in file) {
          files.push((file as any).name);
        }
      }
    }

    if (files.length === 0) {
      console.error(
        `[get_project_overview] No files found matching pattern: ${pattern}`,
      );
      return;
    }

    console.error(`[get_project_overview] Indexing ${files.length} files...`);

    const startTime = Date.now();
    await index.indexFiles(files, concurrency);

    const duration = Date.now() - startTime;
    const newStats = index.getStats();
    console.error(
      `[get_project_overview] Initial indexing completed: ${newStats.totalFiles} files, ${newStats.totalSymbols} symbols in ${duration}ms`,
    );
  }
}

export const getProjectOverviewTool: ToolDef<typeof getProjectOverviewSchema> =
  {
    name: "get_project_overview",
    description:
      "Get a quick overview of the project structure, key components, and statistics. " +
      "This tool automatically creates an index if needed and provides a concise summary.",
    schema: getProjectOverviewSchema,
    execute: async ({ root }) => {
      const rootPath = root || process.cwd();

      // Ensure index exists
      await ensureIndexExists(rootPath);

      // Get project info
      const projectInfo = await getProjectInfo(rootPath);

      // Get statistics
      const stats = getIndexStats(rootPath);

      // Get all symbols for analysis
      const allSymbols = querySymbols(rootPath, {});

      // Get symbols by kind
      const functions = querySymbols(rootPath, { kind: SymbolKind.Function });
      const methods = querySymbols(rootPath, { kind: SymbolKind.Method });
      const classes = querySymbols(rootPath, { kind: SymbolKind.Class });
      const interfaces = querySymbols(rootPath, { kind: SymbolKind.Interface });
      const enums = querySymbols(rootPath, { kind: SymbolKind.Enum });
      const constants = querySymbols(rootPath, { kind: SymbolKind.Constant });
      const variables = querySymbols(rootPath, { kind: SymbolKind.Variable });

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
      output += "\n";

      // Directory structure with file counts
      if (directories.size > 0) {
        output += "### Structure:\n```\n";
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
          output += `\nExported Functions (${exportedFunctions.length}):\n`;
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

          output += `\nClass Methods:\n`;
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
        output += `**Classes** (${classes.length}):\n`;
        classes.slice(0, limit).forEach((c) => {
          const classMethods = methods.filter(
            (m) => m.containerName === c.name,
          );
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
        output += `**Interfaces** (${interfaces.length}):\n`;
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
        output += `**Enums** (${enums.length}):\n`;
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
      output += "1. Use `search_symbol_from_index` to find specific symbols\n";
      output += "2. Use `get_document_symbols` to explore specific files\n";
      output += "3. Use `find_references` to trace symbol usage\n";

      return output;
    },
  };
