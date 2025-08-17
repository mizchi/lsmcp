// import { spawn, type ChildProcess } from "child_process";
import { join } from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { LspClientConfig } from "../../src/config/schema.ts";

/**
 * Test helper to verify MCP server connection and tools
 */
export async function testMcpConnection(
  adapter: LspClientConfig,
  projectPath: string,
  testFile?: string, // Optional: specify the test file to use
): Promise<{
  connected: boolean;
  hasGetProjectOverview: boolean;
  hasGetDiagnostics: boolean;
  hasGetDefinitions: boolean;
  hasGetHover: boolean;
  hasSearchSymbols: boolean;
  hasGetSymbolDetails: boolean;
  projectOverview?: any;
  diagnosticsResult?: any;
  definitionsResult?: any;
  hoverResult?: any;
  searchSymbolsResult?: any;
  symbolDetailsResult?: any;
  error?: string;
}> {
  // let mcpProcess: ChildProcess | null = null;
  let client: Client | null = null;

  try {
    // Build the command to start lsmcp
    const lsmcpPath = join(process.cwd(), "dist", "lsmcp.js");
    const args: string[] = [];

    // Add preset or config
    if ("presetId" in adapter) {
      args.push("-p", adapter.presetId as string);
    } else if (adapter.bin) {
      args.push("--bin", adapter.bin);
      if (adapter.files) {
        args.push("--files", adapter.files.join(","));
      }
    }

    // Create MCP client transport
    const transport = new StdioClientTransport({
      command: "node",
      args: [lsmcpPath, ...args],
      env: {
        ...process.env,
        MCP_DEBUG: "true",
      },
    });

    // Create MCP client
    client = new Client(
      {
        name: "test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    // Connect to the server
    await client.connect(transport);

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // List available tools
    const toolsResponse = await client.listTools();
    const tools = toolsResponse.tools || [];

    // Check if tools exist
    const hasGetProjectOverview = tools.some(
      (tool) => tool.name === "get_project_overview",
    );
    const hasGetDiagnostics = tools.some(
      (tool) => tool.name === "lsp_get_diagnostics",
    );
    const hasGetDefinitions = tools.some(
      (tool) => tool.name === "lsp_get_definitions",
    );
    const hasGetHover = tools.some((tool) => tool.name === "lsp_get_hover");
    const hasSearchSymbols = tools.some(
      (tool) => tool.name === "search_symbols",
    );
    const hasGetSymbolDetails = tools.some(
      (tool) => tool.name === "get_symbol_details",
    );

    let projectOverview;
    if (hasGetProjectOverview) {
      try {
        // Call get_project_overview tool
        const result = await client.callTool({
          name: "get_project_overview",
          arguments: {
            root: projectPath,
          },
        });

        projectOverview = result.content;
      } catch (e) {
        console.log(`Could not get project overview: ${e}`);
      }
    }

    let diagnosticsResult;
    if (hasGetDiagnostics) {
      try {
        // Use provided test file or find first matching file in project
        const { readdirSync, statSync } = await import("fs");
        const { join, relative } = await import("path");

        let fileToTest = testFile;
        if (!fileToTest) {
          // Find first file that matches adapter's file patterns
          const findFirstFile = (dir: string): string | null => {
            const entries = readdirSync(dir);
            for (const entry of entries) {
              const fullPath = join(dir, entry);
              const stat = statSync(fullPath);
              if (
                stat.isDirectory() &&
                !entry.startsWith(".") &&
                entry !== "node_modules" &&
                entry !== "target"
              ) {
                const found = findFirstFile(fullPath);
                if (found) return found;
              } else if (stat.isFile()) {
                const relativePath = relative(projectPath, fullPath);
                // Check if this file matches any of the adapter's file patterns
                if (
                  adapter.files?.some((pattern) => {
                    // Simple check for common extensions
                    return relativePath.endsWith(
                      pattern.replace("**/*", "").replace("**/", ""),
                    );
                  })
                ) {
                  return relativePath;
                }
              }
            }
            return null;
          };
          fileToTest = findFirstFile(projectPath) || undefined;
        }

        if (!fileToTest) {
          console.log("Could not find a suitable test file");
        } else {
          const result = await client.callTool({
            name: "lsp_get_diagnostics",
            arguments: {
              root: projectPath,
              relativePath: fileToTest,
            },
          });

          diagnosticsResult = result.content;
        }
      } catch (e) {
        console.log(`Could not get diagnostics: ${e}`);
      }
    }

    let definitionsResult;
    if (hasGetDefinitions) {
      try {
        // Use the same test file as diagnostics
        const fileToTest = testFile || "main.mbt"; // Fallback for get_definitions

        const result = await client.callTool({
          name: "lsp_get_definitions",
          arguments: {
            root: projectPath,
            relativePath: fileToTest,
            line: 1,
            symbolName: "main", // Common symbol name
          },
        });

        definitionsResult = result.content;
      } catch (e) {
        console.log(`Could not get definitions: ${e}`);
      }
    }

    let hoverResult;
    if (hasGetHover) {
      try {
        // Use the same test file
        const fileToTest = testFile || "main.mbt"; // Fallback for get_hover

        const result = await client.callTool({
          name: "lsp_get_hover",
          arguments: {
            root: projectPath,
            relativePath: fileToTest,
            line: 1,
            character: 0,
          },
        });

        hoverResult = result.content;
      } catch (e) {
        console.log(`Could not get hover: ${e}`);
      }
    }

    let searchSymbolsResult;
    if (hasSearchSymbols) {
      try {
        // Call search_symbols tool - search for common symbol patterns
        const result = await client.callTool({
          name: "search_symbols",
          arguments: {
            root: projectPath,
            query: "", // Empty query to get all symbols
          },
        });

        searchSymbolsResult = result.content;
      } catch (e) {
        console.log(`Could not search symbols: ${e}`);
      }
    }

    let symbolDetailsResult;
    if (hasGetSymbolDetails) {
      try {
        // First, try to find a symbol using search_symbols
        // Use different query based on language
        const presetId = (adapter as any).presetId;
        const symbolQuery =
          presetId === "typescript" ||
          presetId === "tsgo" ||
          presetId === "deno"
            ? "User" // TypeScript/JavaScript has User interface
            : "main"; // Other languages typically have main function

        const searchResult = await client.callTool({
          name: "search_symbols",
          arguments: {
            root: projectPath,
            query: symbolQuery,
          },
        });

        // Parse the search result to find a symbol
        if (
          searchResult.content &&
          Array.isArray(searchResult.content) &&
          searchResult.content.length > 0
        ) {
          const symbolsText = (searchResult.content[0] as any).text;
          // Extract first symbol information from the formatted output
          const lines = symbolsText.split("\n");
          for (const line of lines) {
            // Look for lines that contain file paths and line numbers
            const match = line.match(/^(.+?):(\d+):/);
            if (match) {
              const [, relativePath, lineStr] = match;
              const lineNumber = parseInt(lineStr);

              // Try to get symbol details
              const detailsResult = await client.callTool({
                name: "get_symbol_details",
                arguments: {
                  root: projectPath,
                  relativePath: relativePath.trim(),
                  line: lineNumber,
                  symbol: symbolQuery, // Use the symbol we searched for
                },
              });

              symbolDetailsResult = detailsResult.content;
              break; // Just test the first found symbol
            }
          }
        }
      } catch (e) {
        console.log(`Could not get symbol details: ${e}`);
      }
    }

    // Clean up
    await client.close();

    return {
      connected: true,
      hasGetProjectOverview,
      hasGetDiagnostics,
      hasGetDefinitions,
      hasGetHover,
      hasSearchSymbols,
      hasGetSymbolDetails,
      projectOverview,
      diagnosticsResult,
      definitionsResult,
      hoverResult,
      searchSymbolsResult,
      symbolDetailsResult,
    };
  } catch (error: any) {
    // Cleanup on error
    if (client) {
      try {
        await client.close();
      } catch {}
    }

    return {
      connected: false,
      hasGetProjectOverview: false,
      hasGetDiagnostics: false,
      hasGetDefinitions: false,
      hasGetHover: false,
      hasSearchSymbols: false,
      hasGetSymbolDetails: false,
      error: error.message || String(error),
    };
  }
}
