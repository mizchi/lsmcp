import { describe, expect, it } from "vitest";
import { spawn } from "child_process";
import { cp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { mkdir, rm } from "fs/promises";
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

// Create test project directory
async function createTestProject(name: string): Promise<string> {
  const testDir = join(tmpdir(), `lsmcp-adapter-test-${name}-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
  return testDir;
}

// Clean up test project
async function cleanupTestProject(testDir: string): Promise<void> {
  try {
    await rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// Copy fixture to test directory
async function copyFixture(
  fixtureName: string,
  testDir: string,
): Promise<void> {
  const fixtureDir = join(import.meta.dirname, "fixtures", fixtureName);
  await cp(fixtureDir, testDir, { recursive: true });
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

  const testDir = await createTestProject(adapter.id);

  try {
    // Copy fixture files
    await copyFixture(fixtureName, testDir);

    // Start LSP server
    const config = adapterToLanguageConfig(adapter);
    const lspCommand = typeof config.lspCommand === "function"
      ? config.lspCommand()
      : config.lspCommand;
    const lspProcess = spawn(lspCommand, config.lspArgs || [], {
      cwd: testDir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Create LSP client
    const client = createLSPClient({
      rootPath: testDir,
      process: lspProcess,
      languageId: adapter.baseLanguage,
      initializationOptions: config.initializationOptions,
    });

    // Start the client - this will throw if connection fails
    await client.start();

    // Connection successful - wait a bit for initialization
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));

    // Try to get some file in the project
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
      testDir,
      testFiles[adapter.baseLanguage] || testFiles[adapter.id] || "main.*",
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
  } finally {
    await cleanupTestProject(testDir);
  }
}

describe("Language Adapter LSP Connections", () => {
  describe("TypeScript Adapter", () => {
    it(
      "should connect to TypeScript language server",
      async () => {
        const result = await testLspConnection(typescriptAdapter, "typescript");
        expect(result).toMatchInlineSnapshot();
      },
      30000,
    );
  });

  describe("tsgo Adapter", () => {
    it(
      "should connect to tsgo language server",
      async () => {
        const result = await testLspConnection(tsgoAdapter, "typescript");
        expect(result).toMatchInlineSnapshot();
      },
      30000,
    );
  });

  describe("Deno Adapter", () => {
    it(
      "should connect to Deno language server",
      async () => {
        const result = await testLspConnection(denoAdapter, "deno");
        expect(result).toMatchInlineSnapshot();
      },
      30000,
    );
  });

  describe("Pyright Adapter", () => {
    it(
      "should connect to Pyright language server",
      async () => {
        const result = await testLspConnection(pyrightAdapter, "python");
        expect(result).toMatchInlineSnapshot();
      },
      30000,
    );
  });

  describe("Ruff Adapter", () => {
    it(
      "should connect to Ruff language server",
      async () => {
        const result = await testLspConnection(ruffAdapter, "python");
        expect(result).toMatchInlineSnapshot();
      },
      30000,
    );
  });

  describe("Rust Analyzer Adapter", () => {
    it(
      "should connect to Rust Analyzer",
      async () => {
        const result = await testLspConnection(rustAnalyzerAdapter, "rust");
        expect(result).toMatchInlineSnapshot();
      },
      45000, // Rust analyzer can be slow to initialize
    );
  });

  describe("F# Adapter", () => {
    it(
      "should connect to F# language server",
      async () => {
        const result = await testLspConnection(fsacAdapter, "fsharp");
        expect(result).toMatchInlineSnapshot();
      },
      45000,
    );
  });

  describe("Go Adapter", () => {
    it(
      "should connect to Go language server",
      async () => {
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
        expect(result).toMatchInlineSnapshot();
      },
      30000,
    );
  });

  describe("MoonBit Adapter", () => {
    it(
      "should connect to MoonBit language server",
      async () => {
        const result = await testLspConnection(
          moonbitLanguageServerAdapter,
          "moonbit",
        );
        expect(result).toMatchInlineSnapshot();
      },
      30000,
    );
  });
});
