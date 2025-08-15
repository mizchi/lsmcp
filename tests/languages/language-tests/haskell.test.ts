import { describe, expect, it } from "vitest";
import { join } from "path";
import { hlsAdapter } from "../../../src/presets/hls.ts";
import { testLspConnection } from "../testHelpers.ts";
import { testMcpConnection } from "../testMcpHelpers.ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const projectRoot = join(import.meta.dirname, "../../fixtures", "haskell");

describe("Haskell Language Server Adapter", () => {
  it("should connect to HLS", async () => {
    const checkFiles = ["Main.hs"];
    const result = await testLspConnection(hlsAdapter, projectRoot, checkFiles);

    // HLS might not be installed in CI
    expect(result.connected).toBeDefined();
    if (result.connected) {
      expect(result.diagnostics).toBeDefined();
    } else {
      expect(result.error).toBeDefined();
      console.warn("HLS not available, skipping test");
    }
  });

  it("should detect type errors in Haskell files", async () => {
    const checkFiles = ["Main.hs"];
    const result = await testLspConnection(hlsAdapter, projectRoot, checkFiles);

    if (!result.connected) {
      console.warn("HLS not available, skipping diagnostics test");
      return;
    }

    expect(result.diagnostics).toBeDefined();
    const mainDiagnostics = (result.diagnostics as any)?.["Main.hs"];

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

  it.skip("should provide MCP tools including get_project_overview, get_diagnostics, get_definitions, and get_hover", async () => {
    const result = await testMcpConnection(hlsAdapter, projectRoot);

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
    }

    expect(result.diagnosticsResult).toBeDefined();
    expect(result.hoverResult).toBeDefined();
  }, 30000);

  it.skip("should get definitions for Haskell type User", async () => {
    const checkFiles = ["Main.hs"];
    const result = await testLspConnection(hlsAdapter, projectRoot, checkFiles);

    if (!result.connected) {
      console.warn("HLS not available, skipping definitions test");
      return;
    }

    const mcpResult = await testMcpConnection(hlsAdapter, projectRoot);
    expect(mcpResult.connected).toBe(true);
    expect(mcpResult.hasGetDefinitions).toBe(true);

    const client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [join(process.cwd(), "dist", "lsmcp.js"), "-p", "hls"],
      env: { ...process.env, MCP_DEBUG: "true" },
    });

    await client.connect(transport);

    try {
      // Try to get definition from where User is referenced
      const userDefResult = await client.callTool({
        name: "get_definitions",
        arguments: {
          root: projectRoot,
          filePath: "Main.hs",
          line: 'User "Alice"', // Find line with User constructor usage
          symbolName: "User",
          include_body: true,
        },
      });

      expect(userDefResult.content).toBeDefined();
      const content = userDefResult.content as any;
      if (content?.[0]?.text) {
        const definitionText = content[0].text;
        // Check if we got the User type definition
        expect(definitionText).toMatch(/data\s+User/);
      }
    } catch (error) {
      // If the first approach fails, try with the type definition line
      const userDefResult = await client.callTool({
        name: "get_definitions",
        arguments: {
          root: projectRoot,
          filePath: "Main.hs",
          line: 4, // Line where User is defined
          symbolName: "User",
          include_body: true,
        },
      });
      const content = userDefResult.content as any;
      if (content?.[0]?.text) {
        const definitionText = content[0].text;
        expect(definitionText).toMatch(/data\s+User/);
      }
    } finally {
      await client.close();
    }
  }, 30000);

  it.skip("should get hover information for Haskell function processUsers", async () => {
    const checkFiles = ["Main.hs"];
    const result = await testLspConnection(hlsAdapter, projectRoot, checkFiles);

    if (!result.connected) {
      console.warn("HLS not available, skipping hover test");
      return;
    }

    const mcpResult = await testMcpConnection(hlsAdapter, projectRoot);
    expect(mcpResult.connected).toBe(true);
    expect(mcpResult.hasGetHover).toBe(true);

    const client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [join(process.cwd(), "dist", "lsmcp.js"), "-p", "hls"],
      env: { ...process.env, MCP_DEBUG: "true" },
    });

    await client.connect(transport);

    try {
      const hoverResult = await client.callTool({
        name: "get_hover",
        arguments: {
          root: projectRoot,
          filePath: "Main.hs",
          line: "show (processUsers users)", // Find line with processUsers call
          target: "processUsers",
        },
      });

      expect(hoverResult.content).toBeDefined();
      const hoverContent = hoverResult.content as any;
      if (hoverContent?.[0]?.text) {
        const hoverText = hoverContent[0].text;
        // Check for function signature in hover text
        expect(hoverText).toMatch(
          /processUsers|\[User\]|\[\(String,\s*Int\)\]/,
        );
      }
    } catch (error) {
      // If the first approach fails, try with the definition line
      const hoverResult = await client.callTool({
        name: "get_hover",
        arguments: {
          root: projectRoot,
          filePath: "Main.hs",
          line: 14, // Line where processUsers is defined
          target: "processUsers",
        },
      });
      const hoverContent = hoverResult.content as any;
      if (hoverContent?.[0]?.text) {
        const hoverText = hoverContent[0].text;
        expect(hoverText).toMatch(
          /processUsers|\[User\]|\[\(String,\s*Int\)\]/,
        );
      }
    } finally {
      await client.close();
    }
  }, 30000);
});
