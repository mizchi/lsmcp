/**
 * CLI help functions
 */

import type { PresetRegistry } from "../config/loader.ts";

export function showHelp(): void {
  console.log(`
🌍 LSMCP - Language Service MCP for Multi-Language Support

Usage:
  lsmcp -p <preset> [options]              Start MCP server
  lsmcp --bin <command> [options]          Start with custom LSP
  lsmcp init [-p <preset>]                 Initialize project
  lsmcp index                              Build symbol index

Commands:
  init      Initialize lsmcp project configuration
  index     Build symbol index from config.json

Options:
  -p, --preset <preset>     Language adapter to use (e.g., tsgo, deno, pyright)
  --config <path>           Load language configuration from JSON file
  --bin <command>           Custom LSP server command (e.g., "deno lsp", "rust-analyzer")
  --initializationOptions <json>  JSON string for LSP initialization options
  --list                    List all supported languages and presets
  -h, --help               Show this help message

Examples:
  lsmcp init -p typescript     Initialize TypeScript project
  lsmcp index                  Build symbol index
  lsmcp -p typescript          Use TypeScript MCP server
  lsmcp -p tsgo                Use tsgo TypeScript preset
  lsmcp --bin "deno lsp"       Use custom LSP server
`);
}

export function showListWithConfigLoader(
  adapterRegistry: PresetRegistry,
): void {
  console.log("Available adapters with --preset:");
  const adapterList = adapterRegistry.list();
  for (const adapter of adapterList) {
    const id =
      "presetId" in adapter ? adapter.presetId : (adapter as any).id || "";
    const description = (adapter as any).description || "";
    console.log(`  ${id.padEnd(25)} - ${description}`);
  }

  console.log("\nFor custom language configuration, use --config:");
  console.log('  --config "./my-language.json"');
  console.log("\nFor other languages or custom LSP servers, use --bin:");
  console.log('  --bin "deno lsp" for Deno');
  console.log('  --bin "clangd" for C/C++');
  console.log('  --bin "jdtls" for Java');
}

export function showNoArgsHelp(adapterRegistry: PresetRegistry): void {
  console.log(`
🌍 LSMCP - Language Service MCP

No configuration found. Please initialize your project first:

  lsmcp init -p <preset>

Available presets:`);

  const adapterList = adapterRegistry.list();
  const primaryAdapters = [
    "typescript",
    "tsgo",
    "pyright",
    "rust-analyzer",
    "gopls",
  ];

  // Show primary adapters first
  for (const id of primaryAdapters) {
    const adapter = adapterList.find((a) => {
      const adapterId = "presetId" in a ? a.presetId : (a as any).id;
      return adapterId === id;
    });
    if (adapter) {
      const adapterId =
        "presetId" in adapter ? adapter.presetId : (adapter as any).id || "";
      const description = (adapter as any).description || "";
      console.log(`  ${adapterId.padEnd(20)} - ${description}`);
    }
  }

  console.log(`
For a complete list of presets:
  lsmcp --list

For help:
  lsmcp --help
`);
}
