import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "child_process";
import { createLSPClient } from "../../src/lsp/lspClient.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";

describe("LSP initialization with different servers", () => {
  const testFile = join(process.cwd(), "test-init.ts");

  beforeAll(() => {
    // Create a test file
    writeFileSync(testFile, "const x = 1;\n");
  });

  afterAll(() => {
    // Clean up test file
    try {
      unlinkSync(testFile);
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should initialize TypeScript LSP with server readiness check", async () => {
    const tsServerPath = "npx";
    const tsServerArgs = ["typescript-language-server", "--stdio"];

    const lspProcess = spawn(tsServerPath, tsServerArgs, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const client = createLSPClient({
      rootPath: process.cwd(),
      process: lspProcess,
      languageId: "typescript",
    });

    const startTime = Date.now();

    try {
      await client.start();

      const initTime = Date.now() - startTime;
      console.log(`TypeScript LSP initialized in ${initTime}ms`);

      // Verify that the test document was created and closed
      expect(initTime).toBeLessThan(3000); // Should be much faster than old 5s timeout

      // Open a real document to verify it works
      const fileUri = `file://${testFile}`;
      client.openDocument(fileUri, "const x = 1;\n", "typescript");

      // Wait a bit and check if we can get diagnostics
      await new Promise((resolve) => setTimeout(resolve, 500));

      const diagnostics = client.getDiagnostics(fileUri);
      expect(diagnostics).toBeDefined();
    } finally {
      await client.stop();
    }
  });

  it("should handle TSGo LSP initialization", async () => {
    // Use the correct TSGo command
    const tsgoPath = "npx";
    const tsgoArgs = ["tsgo", "--lsp", "--stdio"];

    const lspProcess = spawn(tsgoPath, tsgoArgs, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const client = createLSPClient({
      rootPath: process.cwd(),
      process: lspProcess,
      languageId: "typescript",
      initializationOptions: {
        preferences: {
          includeInlayParameterNameHints: "none",
          includeInlayParameterNameHintsWhenArgumentMatchesName: false,
          includeInlayFunctionParameterTypeHints: false,
          includeInlayVariableTypeHints: false,
          includeInlayPropertyDeclarationTypeHints: false,
          includeInlayFunctionLikeReturnTypeHints: false,
          includeInlayEnumMemberValueHints: false,
        },
        maxTsServerMemory: 4096,
      },
    });

    const startTime = Date.now();

    try {
      console.log(
        "Starting TSGo LSP client with command: npx tsgo --lsp --stdio",
      );
      await client.start();

      const initTime = Date.now() - startTime;
      console.log(`TSGo LSP initialized in ${initTime}ms`);

      expect(initTime).toBeLessThan(10000); // Allow more time for TSGo
    } finally {
      await client.stop();
    }
  }, 20000); // Increase timeout for TSGo
});
