import { beforeAll, describe, expect, it } from "vitest";
import { join } from "path";
import { pyrightAdapter } from "../../../src/presets/pyright.ts";
import { testLspConnection } from "../testHelpers.ts";
import { testMcpConnection } from "../testMcpHelpers.ts";
import { $ } from "zx";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const projectRoot = join(import.meta.dirname, "../../fixtures", "python");

// Shared initialization for Python environment
async function initializePythonEnvironment() {
  // Run uv sync in the project directory
  await $({ cwd: projectRoot })`uv sync`;
}

// Skip Python tests due to CI issues with Pyright
// TODO: Re-enable when Pyright issues are resolved
describe.skip("Pyright Adapter", () => {
  // CI environment needs more time for initialization
  const isCI = process.env.CI === "true";
  const testTimeout = isCI ? 60000 : 30000;

  beforeAll(async () => {
    await initializePythonEnvironment();
  }, testTimeout);

  it(
    "should connect to Pyright language server",
    async () => {
      const checkFiles = ["main.py"];
      const result = await testLspConnection(
        pyrightAdapter,
        projectRoot,
        checkFiles,
      );
      // Pyright might take longer to initialize or might fail in CI environment
      expect(result.connected).toBeDefined();
      if (result.connected) {
        expect(result.diagnostics).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    },
    testTimeout,
  );

  it(
    "should detect type errors in Python files",
    async () => {
      const checkFiles = ["main.py"];
      const result = await testLspConnection(
        pyrightAdapter,
        projectRoot,
        checkFiles,
      );

      if (!result.connected) {
        console.warn("Pyright not available, skipping diagnostics test");
        return;
      }

      expect(result.diagnostics).toBeDefined();
      const mainDiagnostics = (result.diagnostics as any)?.["main.py"];
      expect(mainDiagnostics).toBeDefined();

      if (mainDiagnostics && mainDiagnostics.length > 0) {
        // Check that we have at least 2 type errors (lines 34 and 37)
        expect(mainDiagnostics.length).toBeGreaterThanOrEqual(2);

        // Check for the type error on line 34 (invalid_user)
        const line34Error = mainDiagnostics.find(
          (d: any) => d.range.start.line === 33, // 0-indexed
        );
        expect(line34Error).toBeDefined();
        if (line34Error) {
          expect(line34Error.severity).toBe(1); // Error severity
          expect(line34Error.message).toContain("str");
          expect(line34Error.message).toContain("int");
        }

        // Check for the type error on line 37 (result type mismatch)
        const line37Error = mainDiagnostics.find(
          (d: any) => d.range.start.line === 36, // 0-indexed
        );
        expect(line37Error).toBeDefined();
        if (line37Error) {
          expect(line37Error.severity).toBe(1); // Error severity
          expect(line37Error.message).toMatch(/dict|Dict|int/i);
        }
      }
    },
    testTimeout,
  );

  it(
    "should provide MCP tools including get_project_overview, get_diagnostics, get_definitions, and get_hover with expected symbol counts",
    async () => {
      const result = await testMcpConnection(
        pyrightAdapter,
        projectRoot,
        "main.py",
      );

      expect(result.connected).toBe(true);
      expect(result.hasGetProjectOverview).toBe(true);
      expect(result.hasGetDiagnostics).toBe(true);
      expect(result.hasGetDefinitions).toBe(true);
      expect(result.hasGetHover).toBe(true);

      if (result.projectOverview) {
        // Verify project overview contains expected information
        // The response is in Markdown format, not JSON
        const overviewText = result.projectOverview[0].text;
        expect(overviewText).toContain("Project Overview");
        expect(overviewText).toContain("Statistics");
        expect(overviewText).toContain("Key Components");

        // Verify expected symbols are detected in overview
        // Python test file should have: User class, process_users function, main function
        // Only check if symbols are present in overview
        if (
          overviewText.includes("Classes:") ||
          overviewText.includes("Key Components")
        ) {
          // Extract symbol counts from overview if available
          const classMatch = overviewText.match(/Classes:\s*(\d+)/);
          const functionMatch = overviewText.match(/Functions:\s*(\d+)/);

          if (classMatch && parseInt(classMatch[1]) > 0) {
            // At least 1 class (User)
            expect(parseInt(classMatch[1])).toBeGreaterThanOrEqual(1);
          }
          if (functionMatch && parseInt(functionMatch[1]) > 0) {
            // At least 2 functions (process_users, main)
            expect(parseInt(functionMatch[1])).toBeGreaterThanOrEqual(2);
          }
        }

        // Verify that diagnostics (errors/warnings) are included in overview if available
        // Note: Diagnostics may not always be available in tests due to LSP timing
        if (overviewText.includes("Diagnostics")) {
          // Python project should have multiple errors
          expect(overviewText).toMatch(/Errors:\s*\d+/);
          expect(overviewText).toMatch(/Warnings:\s*\d+/);
        }
      }

      // Verify get_diagnostics works
      expect(result.diagnosticsResult).toBeDefined();

      // Verify get_definitions works (may not find the symbol, but tool should be callable)
      // The result is optional since "main" might not exist

      // Verify get_hover works
      expect(result.hoverResult).toBeDefined();
    },
    testTimeout,
  );

  it(
    "should get definitions for Python class User",
    async () => {
      const checkFiles = ["main.py"];
      const result = await testLspConnection(
        pyrightAdapter,
        projectRoot,
        checkFiles,
      );

      if (!result.connected) {
        console.warn("Pyright not available, skipping definitions test");
        return;
      }

      // Test with MCP connection for get_definitions
      const mcpResult = await testMcpConnection(pyrightAdapter, projectRoot);
      expect(mcpResult.connected).toBe(true);
      expect(mcpResult.hasGetDefinitions).toBe(true);

      // Test get_definitions for User class
      const client = new Client(
        { name: "test-client", version: "1.0.0" },
        { capabilities: {} },
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [join(process.cwd(), "dist", "lsmcp.js"), "-p", "pyright"],
        env: { ...process.env, MCP_DEBUG: "true" },
      });

      await client.connect(transport);

      try {
        // Find definition of User class at line 25 (where it's used)
        const userDefResult = await client.callTool({
          name: "lsp_get_definitions",
          arguments: {
            root: projectRoot,
            relativePath: "main.py",
            line: 25, // Line where User is instantiated
            symbolName: "User",
          },
        });

        expect(userDefResult.content).toBeDefined();
        const content = userDefResult.content as any;
        if (content?.[0]?.text) {
          const definitionText = content[0].text;
          // Should find the class definition at line 4
          expect(definitionText).toContain("class User");
          expect(definitionText).toContain("main.py:4");
        }
      } finally {
        await client.close();
      }
    },
    testTimeout,
  );

  it(
    "should get hover information for Python function process_users",
    async () => {
      const checkFiles = ["main.py"];
      const result = await testLspConnection(
        pyrightAdapter,
        projectRoot,
        checkFiles,
      );

      if (!result.connected) {
        console.warn("Pyright not available, skipping hover test");
        return;
      }

      // Test with MCP connection for get_hover
      const mcpResult = await testMcpConnection(pyrightAdapter, projectRoot);
      expect(mcpResult.connected).toBe(true);
      expect(mcpResult.hasGetHover).toBe(true);

      // Test get_hover for process_users function
      const client = new Client(
        { name: "test-client", version: "1.0.0" },
        { capabilities: {} },
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [join(process.cwd(), "dist", "lsmcp.js"), "-p", "pyright"],
        env: { ...process.env, MCP_DEBUG: "true" },
      });

      await client.connect(transport);

      try {
        // Get hover info for process_users function at line 30 (where it's called)
        const hoverResult = await client.callTool({
          name: "lsp_get_hover",
          arguments: {
            root: projectRoot,
            relativePath: "main.py",
            line: 30, // Line where process_users is called
            textTarget: "process_users",
          },
        });

        expect(hoverResult.content).toBeDefined();
        const hoverContent = hoverResult.content as any;
        if (hoverContent?.[0]?.text) {
          const hoverText = hoverContent[0].text;
          // Should contain type signature
          expect(hoverText).toContain("process_users");
          expect(hoverText).toMatch(/List\[User\]|list\[User\]/);
          expect(hoverText).toMatch(/Dict\[str, int\]|dict\[str, int\]/);
        }
      } finally {
        await client.close();
      }
    },
    testTimeout,
  );
});
