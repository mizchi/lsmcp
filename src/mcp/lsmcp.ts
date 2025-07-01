#!/usr/bin/env node
/**
 * lsmcp - Language Service MCP
 *
 * Main entry point for the lsmcp tool that provides MCP integration
 * for TypeScript/JavaScript (built-in) or any LSP server (via --bin).
 */

import { parseArgs } from "node:util";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { debug } from "./_mcplib.ts";
import { ErrorContext, formatError } from "./utils/errorHandler.ts";
import {
  getLSPCommandForLanguage,
  getSupportedLanguages,
} from "./utils/languageInit.ts";

// Parse command line arguments
const { values, positionals } = parseArgs({
  options: {
    language: {
      type: "string",
      short: "l",
      description: "Language to use (typescript, moonbit, rust, etc.)",
    },
    bin: {
      type: "string",
      description:
        'Custom LSP server command (e.g., "deno lsp", "rust-analyzer")',
    },
    include: {
      type: "string",
      description:
        'Glob pattern for files to get diagnostics (e.g., "src/**/*.ts")',
    },
    help: {
      type: "boolean",
      short: "h",
      description: "Show help message",
    },
    list: {
      type: "boolean",
      description: "List supported languages",
    },
  },
  allowPositionals: true,
});

function showHelp() {
  console.log(`
🌍 LSMCP - Language Service MCP for Multi-Language Support

Usage:
  lsmcp --language <lang> [options]
  lsmcp --bin <command> [options]

Options:
  -l, --language <lang>     Language to use (required unless --bin is provided)
  --bin <command>           Custom LSP server command (e.g., "deno lsp", "rust-analyzer")
  --include <pattern>       Glob pattern for files to get diagnostics (TypeScript/JS only)
  --list                    List all supported languages
  -h, --help               Show this help message

Examples:
  lsmcp -l typescript          Use TypeScript MCP server
  lsmcp -l rust                Use Rust MCP server
  lsmcp --bin "deno lsp"       Use custom LSP server
  lsmcp --include "src/**/*.ts" -l typescript  Get diagnostics for TypeScript files

Supported Languages:
  - TypeScript/JavaScript (built-in support)
  - Any language via LSP server with --bin option

Environment Variables:
  FORCE_LANGUAGE        Force a specific language (same as -l)
`);
}

async function runLanguageServer(
  language: string,
  args: string[] = [],
  customEnv?: Record<string, string | undefined>,
  includePattern?: string,
) {
  debug(
    `[lsmcp] runLanguageServer called with language: ${language}, args: ${
      JSON.stringify(args)
    }`,
  );

  // Handle language-specific LSP servers
  if (language !== "typescript" && language !== "javascript") {
    const lspCommand = getLSPCommandForLanguage(language);
    if (!lspCommand) {
      const supported = getSupportedLanguages();
      console.error(`Error: Language '${language}' is not supported.`);
      console.error(
        `Supported languages: typescript, javascript, ${supported.join(", ")}`,
      );
      console.error("Or use --bin option to specify a custom LSP server.");
      process.exit(1);
    }

    // Use generic LSP server with the detected command
    debug(
      `[lsmcp] Using LSP command '${lspCommand}' for language '${language}'`,
    );
    const env: Record<string, string | undefined> = {
      ...process.env,
      ...customEnv,
      LSP_COMMAND: lspCommand,
    };

    // Get the path to the generic LSP server
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const genericServerPath = join(__dirname, "generic-lsp-mcp.js");

    if (!existsSync(genericServerPath)) {
      const context: ErrorContext = {
        operation: "Generic LSP MCP server startup",
        language,
        details: { path: genericServerPath },
      };
      const error = new Error(
        `Generic LSP MCP server not found at ${genericServerPath}`,
      );
      console.error(formatError(error, context));
      process.exit(1);
    }

    debug(`Starting generic LSP MCP server: ${genericServerPath}`);

    // Forward to generic LSP server
    const serverProcess = spawn("node", [
      genericServerPath,
      `--lsp-command=${lspCommand}`,
      ...args,
    ], {
      stdio: "inherit",
      env,
    });

    serverProcess.on("error", (error) => {
      const context: ErrorContext = {
        operation: "Generic LSP MCP server process",
        language,
        details: { command: lspCommand },
      };
      console.error(formatError(error, context));
      process.exit(1);
    });

    serverProcess.on("exit", (code) => {
      process.exit(code || 0);
    });

    return;
  }

  // Get the path to the TypeScript server
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const serverPath = join(__dirname, "typescript-mcp.js");

  // Merge environment variables
  const env = customEnv ? { ...process.env, ...customEnv } : process.env;

  if (!existsSync(serverPath)) {
    const context: ErrorContext = {
      operation: "MCP server startup",
      language,
      filePath: serverPath,
    };
    const error = new Error(`MCP server not found at ${serverPath}`);
    console.error(formatError(error, context));
    process.exit(1);
  }

  debug(`[lsmcp] Starting ${language} MCP server: ${serverPath}`);

  // Forward all arguments to the specific server
  const serverArgs = [serverPath];

  // Add include pattern if provided
  if (includePattern) {
    serverArgs.push(`--include=${includePattern}`);
  }

  serverArgs.push(...args);

  const serverProcess = spawn("node", serverArgs, {
    stdio: "inherit",
    env,
  });

  serverProcess.on("error", (error) => {
    const context: ErrorContext = {
      operation: "MCP server process",
      language,
    };
    console.error(formatError(error, context));
    process.exit(1);
  });

  serverProcess.on("exit", (code) => {
    process.exit(code || 0);
  });
}

async function main() {
  debug(
    `[lsmcp] main() called with values: ${
      JSON.stringify(values)
    }, positionals: ${JSON.stringify(positionals)}`,
  );

  // Show help if requested
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // List languages if requested
  if (values.list) {
    console.log("Supported languages with --language:");
    console.log("  typescript - TypeScript files (.ts, .tsx)");
    console.log("  javascript - JavaScript files (.js, .jsx)");

    const otherLanguages = getSupportedLanguages();
    for (const lang of otherLanguages) {
      const lspCommand = getLSPCommandForLanguage(lang);
      if (lspCommand) {
        console.log(
          `  ${lang.padEnd(10)} - ${
            lang.charAt(0).toUpperCase() + lang.slice(1)
          } [requires ${lspCommand}]`,
        );
      }
    }

    console.log("\nFor other languages or custom LSP servers, use --bin:");
    console.log('  --bin "deno lsp" for Deno');
    console.log('  --bin "clangd" for C/C++');
    console.log('  --bin "jdtls" for Java');
    process.exit(0);
  }

  // Check if custom LSP command is provided
  if (values.bin) {
    debug(`[lsmcp] Using custom LSP command: ${values.bin}`);
    // Use generic LSP MCP server for non-TypeScript languages
    const env: Record<string, string | undefined> = {
      ...process.env,
      LSP_COMMAND: values.bin,
    };

    // Get the path to the generic LSP server
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const genericServerPath = join(__dirname, "generic-lsp-mcp.js");

    if (!existsSync(genericServerPath)) {
      const context: ErrorContext = {
        operation: "Generic LSP MCP server startup",
        details: { path: genericServerPath },
      };
      const error = new Error(
        `Generic LSP MCP server not found at ${genericServerPath}`,
      );
      console.error(formatError(error, context));
      process.exit(1);
    }

    debug(`Starting generic LSP MCP server: ${genericServerPath}`);

    // Forward to generic LSP server
    const serverArgs = [
      genericServerPath,
      `--lsp-command=${values.bin}`,
    ];

    // Forward include option if provided
    if (values.include) {
      serverArgs.push(`--include=${values.include}`);
    }

    serverArgs.push(...positionals);

    const serverProcess = spawn("node", serverArgs, {
      stdio: "inherit",
      env,
    });

    serverProcess.on("error", (error) => {
      const context: ErrorContext = {
        operation: "Generic LSP MCP server process",
        details: { command: values.bin },
      };
      console.error(formatError(error, context));
      process.exit(1);
    });

    serverProcess.on("exit", (code) => {
      process.exit(code || 0);
    });

    return;
  }

  // Note: --include option is now passed through to the language servers
  // for use with lsp_get_all_diagnostics tool

  // Require either --language or --bin option
  const language = values.language || process.env.FORCE_LANGUAGE;
  debug(
    `[lsmcp] Resolved language: ${language}, env.FORCE_LANGUAGE: ${process.env.FORCE_LANGUAGE}`,
  );

  if (!language && !values.bin) {
    console.error("Error: Either --language or --bin option is required");
    console.error("\nExamples:");
    console.error("  lsmcp --language=typescript");
    console.error('  lsmcp --bin="deno lsp"');
    console.error("\nRun 'lsmcp --help' for more information.");
    process.exit(1);
  }

  if (language) {
    debug(`[lsmcp] Running with language: ${language}`);
    // Run the appropriate language server
    await runLanguageServer(language, positionals, undefined, values.include);
  }
}

// Always run main when this script is executed directly
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
