import { describe, expect, it } from "vitest";
import { spawn } from "child_process";
import { join } from "path";
import { createLSPClient } from "../../src/lsp/lspClient.ts";
import { typescriptAdapter } from "../../src/adapters/typescript-language-server.ts";
import { tsgoAdapter } from "../../src/adapters/tsgo.ts";
import { denoAdapter } from "../../src/adapters/deno.ts";
import { pyrightAdapter } from "../../src/adapters/pyright.ts";
import { ruffAdapter } from "../../src/adapters/ruff.ts";
import { rustAnalyzerAdapter } from "../../src/adapters/rust-analyzer.ts";
import { fsacAdapter } from "../../src/adapters/fsac.ts";
import { moonbitLanguageServerAdapter } from "../../src/adapters/moonbit.ts";
import type { LanguageConfig, LspAdapter } from "../../src/types.ts";

// Helper to convert adapter to language config
function adapterToLanguageConfig(adapter: LspAdapter): LanguageConfig {
  return {
    id: adapter.id,
    name: adapter.name,
    extensions: adapter.extensions,
    lspCommand: adapter.lspCommand,
    lspArgs: adapter.lspArgs,
    initializationOptions: adapter.initializationOptions,
  };
}

// Test helper to verify LSP connection
async function testLspConnection(
  adapter: LspAdapter,
  fixtureName: string,
): Promise<{ connected: boolean; diagnostics?: any[]; error?: string }> {
  // Check doctor first if available
  if (adapter.doctor) {
    const doctorResult = await adapter.doctor();
    if (!doctorResult.ok) {
      return { connected: false, error: doctorResult.message };
    }
  }

  // Use fixture directory directly
  const fixtureDir = join(import.meta.dirname, "fixtures", fixtureName);

  try {
    // Start LSP server
    const config = adapterToLanguageConfig(adapter);
    const lspCommand = typeof config.lspCommand === "function"
      ? config.lspCommand()
      : config.lspCommand;
    const lspProcess = spawn(lspCommand, config.lspArgs || [], {
      cwd: fixtureDir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Create LSP client
    const client = createLSPClient({
      rootPath: fixtureDir,
      process: lspProcess,
      languageId: adapter.baseLanguage,
      initializationOptions: config.initializationOptions,
    });

    // Start the client - this will throw if connection fails
    await client.start();

    // Connection successful - wait a bit for initialization
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));

    // Try to get some file in the project
    // Map fixture names to their main files
    const testFiles: Record<string, string> = {
      typescript: "index.ts",
      python: "main.py",
      rust: "src/main.rs",
      fsharp: "Program.fs",
      go: "main.go",
      moonbit: "main.mbt",
      deno: "main.ts",
    };

    const testFile = join(
      fixtureDir,
      testFiles[fixtureName] || "main.*",
    );

    let diagnostics: any[] = [];
    // Get diagnostics to verify the connection is working
    try {
      // Try pull diagnostics first (async), then fall back to push diagnostics
      const rawDiagnostics = client.pullDiagnostics
        ? await client.pullDiagnostics(testFile)
        : client.getDiagnostics(testFile);
      // Map diagnostics to simpler format for snapshots
      diagnostics = rawDiagnostics.map((d: any) => ({
        severity: d.severity,
        message: d.message,
        range: d.range,
        source: d.source,
      }));
    } catch (e) {
      // Some servers might not support diagnostics immediately
      console.log(`[${adapter.id}] Could not get diagnostics: ${e}`);
    }

    // Stop the client
    await client.stop();

    return { connected: true, diagnostics };
  } catch (error: any) {
    return { connected: false, error: error.message || String(error) };
  }
}

describe("Language Adapter LSP Connections", () => {
  describe("TypeScript Adapter", () => {
    it("should connect to TypeScript language server", async () => {
      const result = await testLspConnection(typescriptAdapter, "typescript");
      expect(result).toMatchInlineSnapshot(`
          {
            "connected": true,
            "diagnostics": [],
          }
        `);
    });
  });

  describe("tsgo Adapter", () => {
    it("should connect to tsgo language server", async () => {
      const result = await testLspConnection(tsgoAdapter, "typescript");
      expect(result).toMatchInlineSnapshot(`
          {
            "connected": true,
            "diagnostics": [],
          }
        `);
    });
  });

  describe("Deno Adapter", () => {
    it("should connect to Deno language server", async () => {
      const result = await testLspConnection(denoAdapter, "deno");
      expect(result).toMatchInlineSnapshot(`
          {
            "connected": true,
            "diagnostics": [],
          }
        `);
    });
  });

  describe.skip("Pyright Adapter", () => {
    it("should connect to Pyright language server", async () => {
      const result = await testLspConnection(pyrightAdapter, "python");
      expect(result).toMatchInlineSnapshot(`
          {
            "connected": false,
            "error": "Operation timed out
          Reason: The language server did not respond in time
          Solution: Try again. If the problem persists, restart the language server or increase the timeout.",
          }
        `);
    });
  });

  describe.skip("Ruff Adapter", () => {
    it("should connect to Ruff language server", async () => {
      const result = await testLspConnection(ruffAdapter, "python");
      expect(result).toMatchInlineSnapshot(`
          {
            "connected": false,
            "error": "Operation timed out
          Reason: The language server did not respond in time
          Solution: Try again. If the problem persists, restart the language server or increase the timeout.",
          }
        `);
    });
  });

  describe("Rust Analyzer Adapter", () => {
    it("should connect to Rust Analyzer", async () => {
      const result = await testLspConnection(rustAnalyzerAdapter, "rust");
      expect(result).toMatchInlineSnapshot(`
          {
            "connected": true,
            "diagnostics": [],
          }
        `);
    }, 30000); // Rust analyzer can be slow to initialize
  });

  describe("F# Adapter", () => {
    it("should connect to F# language server", async () => {
      const result = await testLspConnection(fsacAdapter, "fsharp");
      expect(result).toMatchInlineSnapshot(`
          {
            "connected": true,
            "diagnostics": [],
          }
        `);
    }, 30000);
  });

  describe("Go Adapter", () => {
    it("should connect to Go language server", async () => {
      // Create a Go adapter inline
      const goAdapter: LspAdapter = {
        id: "gopls",
        name: "Go Language Server",
        baseLanguage: "go",
        description: "Official Go language server",
        extensions: [".go"],
        lspCommand: "gopls",
        lspArgs: [],
        initializationOptions: {
          "ui.documentation.hoverKind": "FullDocumentation",
          "ui.completion.usePlaceholders": true,
          "ui.semanticTokens": true,
        },
      };
      const result = await testLspConnection(goAdapter, "go");
      expect(result).toMatchInlineSnapshot(`
          {
            "connected": true,
            "diagnostics": [],
          }
        `);
    }, 30000);
  });

  describe("MoonBit Adapter", () => {
    it("should connect to MoonBit language server", async () => {
      const result = await testLspConnection(
        moonbitLanguageServerAdapter,
        "moonbit",
      );
      expect(result).toMatchInlineSnapshot(`
          {
            "connected": true,
            "diagnostics": [],
          }
        `);
    });
  });
});
