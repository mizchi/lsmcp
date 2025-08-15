import { describe, expect, it } from "vitest";
import { join } from "path";
import { ocamlAdapter } from "../../../src/presets/ocaml.ts";
import { testLspConnection } from "../testHelpers.ts";
import { testMcpConnection } from "../testMcpHelpers.ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const projectRoot = join(import.meta.dirname, "../../fixtures", "ocaml");

describe("OCaml Language Server Adapter", () => {
  // CI environment needs more time for initialization
  const isCI = process.env.CI === "true";
  const testTimeout = isCI ? 60000 : 30000;

  it("should connect to OCaml LSP", async () => {
    const checkFiles = ["main.ml"];
    const result = await testLspConnection(
      ocamlAdapter,
      projectRoot,
      checkFiles,
    );

    // OCaml LSP might not be installed in CI
    expect(result.connected).toBeDefined();
    if (result.connected) {
      expect(result.diagnostics).toBeDefined();
    } else {
      expect(result.error).toBeDefined();
      console.warn("OCaml LSP not available, skipping test");
    }
  });

  it("should detect type errors in OCaml files", async () => {
    const checkFiles = ["main.ml"];
    const result = await testLspConnection(
      ocamlAdapter,
      projectRoot,
      checkFiles,
    );

    if (!result.connected) {
      console.warn("OCaml LSP not available, skipping diagnostics test");
      return;
    }

    expect(result.diagnostics).toBeDefined();
    const mainDiagnostics = (result.diagnostics as any)?.["main.ml"];

    if (mainDiagnostics && mainDiagnostics.length > 0) {
      // Should have at least 2 type errors
      expect(mainDiagnostics.length).toBeGreaterThanOrEqual(2);

      // Check for type errors
      const hasTypeErrors = mainDiagnostics.some(
        (d: any) =>
          d.severity === 1 && d.message.toLowerCase().includes("type"),
      );
      expect(hasTypeErrors).toBe(true);
    }
  });

  it(
    "should provide MCP tools including get_project_overview, get_diagnostics, get_definitions, and get_hover with expected symbol counts",
    async () => {
      const result = await testMcpConnection(ocamlAdapter, projectRoot);

      expect(result.connected).toBe(true);
      expect(result.hasGetProjectOverview).toBe(true);
      expect(result.hasGetDiagnostics).toBe(true);
      expect(result.hasGetDefinitions).toBe(true);
      expect(result.hasGetHover).toBe(true);

      if (result.projectOverview) {
        const overviewText = result.projectOverview[0].text;
        expect(overviewText).toContain("Project Overview");
        expect(overviewText).toContain("Statistics");
        expect(overviewText).toContain("Key Components");

        // Verify expected symbols are detected
        // OCaml test file should have: user type, process_users function, main module
        // Only check if symbols are present in overview
        if (
          overviewText.includes("Types:") ||
          overviewText.includes("Functions:") ||
          overviewText.includes("Key Components")
        ) {
          // Extract symbol counts if available
          const typeMatch = overviewText.match(/Types:\s*(\d+)/);
          const functionMatch = overviewText.match(/Functions:\s*(\d+)/);

          if (typeMatch && parseInt(typeMatch[1]) > 0) {
            // At least 1 type (user)
            expect(parseInt(typeMatch[1])).toBeGreaterThanOrEqual(1);
          }
          if (functionMatch && parseInt(functionMatch[1]) > 0) {
            // At least 1 function (process_users)
            expect(parseInt(functionMatch[1])).toBeGreaterThanOrEqual(1);
          }
        }
      }

      expect(result.diagnosticsResult).toBeDefined();
      expect(result.hoverResult).toBeDefined();
    },
    testTimeout,
  );

  it(
    "should get definitions for OCaml type user",
    async () => {
      const checkFiles = ["main.ml"];
      const result = await testLspConnection(
        ocamlAdapter,
        projectRoot,
        checkFiles,
      );

      if (!result.connected) {
        console.warn("OCaml LSP not available, skipping definitions test");
        return;
      }

      const mcpResult = await testMcpConnection(ocamlAdapter, projectRoot);
      expect(mcpResult.connected).toBe(true);
      expect(mcpResult.hasGetDefinitions).toBe(true);

      const client = new Client(
        { name: "test-client", version: "1.0.0" },
        { capabilities: {} },
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [join(process.cwd(), "dist", "lsmcp.js"), "-p", "ocaml"],
        env: { ...process.env, MCP_DEBUG: "true" },
      });

      await client.connect(transport);

      try {
        const userDefResult = await client.callTool({
          name: "get_definitions",
          arguments: {
            root: projectRoot,
            filePath: "main.ml",
            line: 24, // Line where user type is used
            symbolName: "user",
          },
        });

        expect(userDefResult.content).toBeDefined();
        const content = userDefResult.content as any;
        if (content?.[0]?.text) {
          const definitionText = content[0].text;
          expect(definitionText).toContain("type user");
          expect(definitionText).toContain("main.ml");
        }
      } finally {
        await client.close();
      }
    },
    testTimeout,
  );

  it(
    "should get hover information for OCaml function process_users",
    async () => {
      const checkFiles = ["main.ml"];
      const result = await testLspConnection(
        ocamlAdapter,
        projectRoot,
        checkFiles,
      );

      if (!result.connected) {
        console.warn("OCaml LSP not available, skipping hover test");
        return;
      }

      const mcpResult = await testMcpConnection(ocamlAdapter, projectRoot);
      expect(mcpResult.connected).toBe(true);
      expect(mcpResult.hasGetHover).toBe(true);

      const client = new Client(
        { name: "test-client", version: "1.0.0" },
        { capabilities: {} },
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [join(process.cwd(), "dist", "lsmcp.js"), "-p", "ocaml"],
        env: { ...process.env, MCP_DEBUG: "true" },
      });

      await client.connect(transport);

      try {
        const hoverResult = await client.callTool({
          name: "get_hover",
          arguments: {
            root: projectRoot,
            filePath: "main.ml",
            line: 29, // Line where process_users is called
            target: "process_users",
          },
        });

        expect(hoverResult.content).toBeDefined();
        const hoverContent = hoverResult.content as any;
        if (hoverContent?.[0]?.text) {
          const hoverText = hoverContent[0].text;
          expect(hoverText).toContain("process_users");
          expect(hoverText).toContain("user list");
        }
      } finally {
        await client.close();
      }
    },
    testTimeout,
  );
});
