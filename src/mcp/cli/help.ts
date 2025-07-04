/**
 * CLI help functions
 */

import type { AdapterRegistry } from "../../core/config/configLoader.ts";
import { listLanguages, listAdapters } from "../legacy/legacySupport.ts";

export function showHelp(): void {
  console.log(`
🌍 LSMCP - Language Service MCP for Multi-Language Support

Usage:
  lsmcp -p <preset> [options]
  lsmcp --bin <command> --extensions=<extensions> [options]

Options:
  -p, --preset <preset>     Language adapter to use (e.g., tsgo, deno, pyright)
  -l, --language <lang>     [DEPRECATED] Use -p/--preset instead
  --config <path>           Load language configuration from JSON file
  --bin <command>           Custom LSP server command (e.g., "deno lsp", "rust-analyzer")
  --initializationOptions <json>  JSON string for LSP initialization options
  --list                    List all supported languages and presets
  -h, --help               Show this help message

Examples:
  lsmcp -p typescript          Use TypeScript MCP server
  lsmcp -p tsgo                Use tsgo TypeScript preset
  lsmcp -p deno                Use Deno language server
  lsmcp -p rust                Use Rust MCP server
  lsmcp --bin "deno lsp"       Use custom LSP server
  lsmcp --include "src/**/*.ts" -p typescript  Get diagnostics for TypeScript files
`);
}

export function showListWithConfigLoader(
  adapterRegistry: AdapterRegistry,
): void {
  console.log("Available adapters with --preset:");
  const adapterList = adapterRegistry.list();
  for (const adapter of adapterList) {
    console.log(`  ${adapter.id.padEnd(25)} - ${adapter.description}`);
  }

  console.log("\nFor custom language configuration, use --config:");
  console.log('  --config "./my-language.json"');
  console.log("\nFor other languages or custom LSP servers, use --bin:");
  console.log('  --bin "deno lsp" for Deno');
  console.log('  --bin "clangd" for C/C++');
  console.log('  --bin "jdtls" for Java');
}

export function showListLegacy(adapterRegistry: AdapterRegistry): void {
  console.log("Supported languages with --language:");
  const languageList = listLanguages();
  for (const lang of languageList) {
    const lspCmd = lang.bin;
    console.log(`  ${lang.id.padEnd(12)} - ${lang.name} [requires ${lspCmd}]`);
  }

  console.log("\nAvailable adapters with --preset:");
  const adapterList = listAdapters(adapterRegistry);
  for (const adapter of adapterList) {
    console.log(`  ${adapter.id.padEnd(25)} - ${adapter.description}`);
  }

  console.log("\nFor other languages or custom LSP servers, use --bin:");
  console.log('  --bin "deno lsp" for Deno');
  console.log('  --bin "clangd" for C/C++');
  console.log('  --bin "jdtls" for Java');
  console.log("\nFor custom language configuration, use --config:");
  console.log('  --config "./my-language.json"');
}
