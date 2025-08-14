/**
 * CLI help functions
 */

import type { PresetRegistry } from "../config/loader.ts";

export function showHelp(): void {
  console.log(`
🌍 LSMCP - Language Service MCP for Multi-Language Support

Usage:
  lsmcp -p <preset>                        Start MCP server with preset
  lsmcp --files <pattern>                  Start MCP server with file patterns
  lsmcp --bin <command> --files <pattern>  Start with custom LSP
  lsmcp init [-p <preset>]                 Initialize project
  lsmcp index                              Build symbol index
  lsmcp doctor [-p <preset>]               Analyze environment & suggest setup

Commands:
  init      Initialize lsmcp project configuration
  index     Build symbol index from config.json
  doctor    Analyze environment and suggest MCP configurations

Options:
  -p, --preset <preset>     Language adapter to use (see list below)
  --config <path>           Load language configuration from JSON file
  --bin <command>           Custom LSP server command (requires --files)
  --files <pattern>         File patterns to handle (e.g., "**/*.rs")
  --initializationOptions <json>  JSON string for LSP initialization options
  --list                    List all supported languages and presets
  -h, --help               Show this help message

Note: Either --preset, --config, --bin, or --files is required

Supported Presets:
  tsgo              TypeScript (Fast native implementation) - Recommended
  typescript        TypeScript/JavaScript (typescript-language-server)
  pyright           Python (Microsoft Pyright)
  ruff              Python (Ruff LSP)
  rust-analyzer     Rust
  gopls             Go
  fsharp            F#
  moonbit           MoonBit
  deno              Deno (TypeScript/JavaScript)

Custom LSP Server:
  For languages not in the preset list, use --bin with --files:
  
  lsmcp --bin "clangd" --files "**/*.{c,cpp,h,hpp}"          # C/C++
  lsmcp --bin "jdtls" --files "**/*.java"                    # Java
  lsmcp --bin "lua-language-server" --files "**/*.lua"       # Lua
  lsmcp --bin "solargraph" --files "**/*.rb"                 # Ruby
  lsmcp --bin "haskell-language-server" --files "**/*.hs"    # Haskell

Examples:
  lsmcp init -p tsgo           Initialize with tsgo (recommended for TypeScript)
  lsmcp doctor                 Check environment and get setup commands
  lsmcp -p tsgo                Start tsgo TypeScript MCP server
  lsmcp --bin "deno lsp" --files "**/*.ts"  Use Deno LSP for TypeScript files
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
