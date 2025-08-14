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
): Promise<{
  connected: boolean;
  hasGetProjectOverview: boolean;
  hasGetDiagnostics: boolean;
  hasGetDefinitions: boolean;
  projectOverview?: any;
  diagnosticsResult?: any;
  definitionsResult?: any;
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
      (tool) => tool.name === "get_diagnostics",
    );
    const hasGetDefinitions = tools.some(
      (tool) => tool.name === "get_definitions",
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
        // Call get_diagnostics tool - try with a sample file
        // Use a common file name that exists in test fixtures
        const testFile =
          adapter.baseLanguage === "python"
            ? "main.py"
            : adapter.baseLanguage === "rust"
              ? "src/main.rs"
              : adapter.baseLanguage === "fsharp"
                ? "Program.fs"
                : adapter.baseLanguage === "moonbit"
                  ? "main.mbt"
                  : "index.ts"; // Default for TypeScript/JavaScript

        const result = await client.callTool({
          name: "get_diagnostics",
          arguments: {
            root: projectPath,
            filePath: testFile,
          },
        });

        diagnosticsResult = result.content;
      } catch (e) {
        console.log(`Could not get diagnostics: ${e}`);
      }
    }

    let definitionsResult;
    if (hasGetDefinitions) {
      try {
        // Call get_definitions tool - try to find a common symbol
        const testFile =
          adapter.baseLanguage === "python"
            ? "main.py"
            : adapter.baseLanguage === "rust"
              ? "src/main.rs"
              : adapter.baseLanguage === "fsharp"
                ? "Program.fs"
                : adapter.baseLanguage === "moonbit"
                  ? "main.mbt"
                  : "index.ts";

        const result = await client.callTool({
          name: "get_definitions",
          arguments: {
            root: projectPath,
            filePath: testFile,
            line: 1,
            symbolName: "main", // Common symbol name
          },
        });

        definitionsResult = result.content;
      } catch (e) {
        console.log(`Could not get definitions: ${e}`);
      }
    }

    // Clean up
    await client.close();

    return {
      connected: true,
      hasGetProjectOverview,
      hasGetDiagnostics,
      hasGetDefinitions,
      projectOverview,
      diagnosticsResult,
      definitionsResult,
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
      error: error.message || String(error),
    };
  }
}
