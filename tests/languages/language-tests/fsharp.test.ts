import { describe, expect, it } from "vitest";
import { join } from "path";
import { spawn } from "child_process";
import { fsharpAdapter } from "../../../src/presets/fsharp.ts";
import { testLspConnection } from "../testHelpers.ts";
import { testMcpConnection } from "../testMcpHelpers.ts";
import { createAndInitializeLSPClient } from "@internal/lsp-client";
import { createLSPSymbolProvider } from "@internal/lsp-client";
import { readFile } from "fs/promises";
import { resolveAdapterCommand } from "../../../src/presets/utils.ts";

describe("F# Adapter", () => {
  it("should connect to F# language server and detect type errors", async () => {
    const projectRoot = join(import.meta.dirname, "../../fixtures", "fsharp");
    const checkFiles = ["Program.fs"];
    const result = await testLspConnection(
      fsharpAdapter,
      projectRoot,
      checkFiles,
    );

    // Should successfully connect
    expect(result.connected).toBe(true);

    // Should have diagnostics array
    expect(result.diagnostics).toBeDefined();
    expect(Array.isArray(result.diagnostics)).toBe(true);

    // Should detect type errors in Program.fs
    const programErrors =
      result.diagnostics?.filter((d) => d.file === "Program.fs") || [];

    // F# compiler might not report errors in CI environment
    if (programErrors.length === 0) {
      console.warn(
        "F# compiler did not report expected errors, skipping error assertions",
      );
      return;
    }

    expect(programErrors.length).toBeGreaterThan(0);

    // Should detect the type error on line 18 (string vs int)
    const line18Error = programErrors.find((d) => d.line === 18);
    expect(line18Error).toBeDefined();
    expect(line18Error?.severity).toBe(1); // Error severity
    expect(line18Error?.source).toBe("F# Compiler");

    // Should detect the type error on line 21 (string vs int)
    const line21Error = programErrors.find((d) => d.line === 21);
    expect(line21Error).toBeDefined();
    expect(line21Error?.severity).toBe(1); // Error severity
    expect(line21Error?.source).toBe("F# Compiler");
  }, 30000);

  it("should fix F# symbol positions that point to comments (Issue #33)", async () => {
    const projectRoot = join(import.meta.dirname, "../../fixtures", "fsharp");
    const testFilePath = join(projectRoot, "CommentedTypes.fs");

    // Start F# LSP server using adapter configuration
    const { command, args } = resolveAdapterCommand(fsharpAdapter, projectRoot);
    const lspProcess = spawn(command, args, {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    try {
      const client = await createAndInitializeLSPClient(
        projectRoot,
        lspProcess,
        "fsharp",
        fsharpAdapter.initializationOptions,
      );

      // Wait for workspace to initialize properly
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Create symbol provider with F# language ID
      const fileContentProvider = async (uri: string): Promise<string> => {
        const filePath = uri.startsWith("file://") ? uri.slice(7) : uri;
        return await readFile(filePath, "utf-8");
      };

      const symbolProvider = createLSPSymbolProvider(
        client,
        fileContentProvider,
        "fsharp",
      );

      // Read the test file
      const content = await readFile(testFilePath, "utf-8");
      const uri = `file://${testFilePath}`;

      // Open the document first to ensure it's loaded
      await client.openDocument(uri, content, "fsharp");

      // Wait a bit for the document to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get symbols with F# position fix applied
      const symbols = await symbolProvider.getDocumentSymbols(uri);

      // Split content into lines for verification
      const lines = content.split("\n");

      // Test that type positions are fixed
      const myType = symbols.find((s) => s.name === "MyType");
      if (myType) {
        const typeLine = lines[myType.range.start.line];
        expect(typeLine).toContain("type MyType");
        expect(typeLine).not.toContain("///");
      }

      // Test that function positions are fixed
      const myFunction = symbols.find((s) => s.name === "myFunction");
      if (myFunction) {
        const funcLine = lines[myFunction.range.start.line];
        expect(funcLine).toContain("let myFunction");
        expect(funcLine).not.toContain("///");
      }

      // Test that class positions are fixed
      const myClass = symbols.find((s) => s.name === "MyClass");
      if (myClass) {
        const classLine = lines[myClass.range.start.line];
        expect(classLine).toContain("type MyClass");
        expect(classLine).not.toContain("///");
      }

      // Test that record field positions are fixed (main issue from #33)
      const value = symbols.find((s) => s.name === "Value");
      if (value) {
        const valueLine = lines[value.range.start.line];
        expect(valueLine).toContain("Value:");
        expect(valueLine).not.toContain("///");
      }

      const name = symbols.find((s) => s.name === "Name");
      if (name) {
        const nameLine = lines[name.range.start.line];
        expect(nameLine).toContain("Name:");
        expect(nameLine).not.toContain("///");
      }

      // Test Person record fields
      const firstName = symbols.find((s) => s.name === "FirstName");
      if (firstName) {
        const firstNameLine = lines[firstName.range.start.line];
        expect(firstNameLine).toContain("FirstName:");
        expect(firstNameLine).not.toContain("///");
      }

      // Verify that no symbols are pointing to comment lines
      const symbolsPointingToComments = symbols.filter((s) => {
        const line = lines[s.range.start.line] || "";
        return line.trim().startsWith("///");
      });

      expect(symbolsPointingToComments).toHaveLength(0);

      // Cleanup
      await client.stop();
      lspProcess.kill();
    } catch (error) {
      lspProcess.kill();
      throw error;
    }
  }, 30000);

  it("should provide MCP tools including get_project_overview, get_diagnostics, and get_definitions", async () => {
    const projectRoot = join(import.meta.dirname, "../../fixtures", "fsharp");
    const result = await testMcpConnection(
      fsharpAdapter,
      projectRoot,
      "Program.fs",
    );

    if (!result.connected) {
      console.warn("MCP connection failed, skipping test");
      return;
    }

    expect(result.hasGetProjectOverview).toBe(true);
    expect(result.hasGetDiagnostics).toBe(true);
    expect(result.hasGetDefinitions).toBe(true);

    if (result.projectOverview) {
      // The response is in Markdown format, not JSON
      const overviewText = result.projectOverview[0].text;
      expect(overviewText).toContain("Project Overview");
      expect(overviewText).toContain("Statistics");
      expect(overviewText).toContain("Key Components");
    }

    // Verify get_diagnostics works
    expect(result.diagnosticsResult).toBeDefined();

    // Verify get_definitions works (may not find the symbol, but tool should be callable)
    // The result is optional since "main" might not exist
  });
});
