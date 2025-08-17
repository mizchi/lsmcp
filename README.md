# lsmcp - Language Service Protocol MCP

[![CI](https://github.com/mizchi/lsmcp/actions/workflows/ci.yml/badge.svg)](https://github.com/mizchi/lsmcp/actions/workflows/ci.yml)
[![Language Server Tests](https://github.com/mizchi/lsmcp/actions/workflows/language-tests.yml/badge.svg)](https://github.com/mizchi/lsmcp/actions/workflows/language-tests.yml)
[![npm version](https://badge.fury.io/js/@mizchi%2Flsmcp.svg)](https://www.npmjs.com/package/@mizchi/lsmcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A unified MCP (Model Context Protocol) server that provides advanced code manipulation and analysis capabilities for multiple programming languages through Language Server Protocol integration.

- 🌍 **Multi-Language Support**
- 🔍 **Semantic Code Analysis**
- 🤖 **AI-Optimized**

See [examples/](examples/) for working examples of each supported language configuration.

## Quick Start

```bash
# tsgo (reccommended)
npm add -D @mizchi/lsmcp @typescript/native-preview
npx @mizchi/lsmcp init -p tsgo
claude mcp add lsmcp npx -- -y @mizchi/lsmcp -p tsgo

# with manual --bin
claude mcp add lsmcp npx -- -y @mizchi/lsmcp --bin="<lsp-command>"
```

<details>
<summary>📖 Example Usage with Claude</summary>

## RECOMMENDED WORKFLOW

### 🎯 Core Flow: Overview → Search → Details

```
1. get_project_overview     # Understand the codebase
2. search_symbols           # Find what you need  
3. get_symbol_details       # Deep dive into symbols
```

### 📋 When to Use Each Tool

**Initial Exploration:**
- `get_project_overview` - First tool to understand any codebase
- `list_dir` - Browse directory structure
- `get_symbols_overview` - High-level view of file symbols

**Finding Code:**
- `search_symbols` - Primary search for functions, classes, interfaces
- `lsp_get_document_symbols` - List all symbols in a specific file
- `lsp_get_workspace_symbols` - Alternative workspace-wide search

**Understanding Code:**
- `get_symbol_details` - Complete information in one call (recommended)
- `lsp_get_definitions` - Jump to definition (use `includeBody: true` for full code)
- `lsp_find_references` - Find all usages
- `lsp_get_hover` - Quick type information

**Code Quality:**
- `lsp_get_diagnostics` - Check for errors
- `lsp_get_code_actions` - Get available fixes

**Code Modification:**
- `lsp_rename_symbol` - Safe renaming across codebase
- `lsp_format_document` - Format code
- `replace_range` / `replace_regex` - Text replacements

### Example Workflows

**1. EXPLORING A NEW CODEBASE**
```
1. mcp__lsmcp__get_project_overview
   → Understand structure, main components, statistics
2. mcp__lsmcp__search_symbols --kind "class"
   → Find all classes in the project
3. mcp__lsmcp__get_symbol_details --symbol "MainClass"
   → Deep dive into specific class implementation
```

**2. INVESTIGATING A BUG**
```
1. mcp__lsmcp__search_symbols --name "problematicFunction"
   → Locate the function
2. mcp__lsmcp__get_symbol_details --symbol "problematicFunction"
   → Understand its type, implementation, and usage
3. mcp__lsmcp__lsp_find_references --symbolName "problematicFunction"
   → See all places it's called
4. mcp__lsmcp__lsp_get_diagnostics --relativePath "path/to/file.ts"
   → Check for errors
```

**3. REFACTORING CODE**
```
1. mcp__lsmcp__search_symbols --name "oldMethodName"
   → Find the method to refactor
2. mcp__lsmcp__get_symbol_details --symbol "oldMethodName"
   → Understand current implementation and usage
3. mcp__lsmcp__lsp_rename_symbol --symbolName "oldMethodName" --newName "newMethodName"
   → Safely rename across codebase
4. mcp__lsmcp__lsp_format_document --relativePath "path/to/file.ts"
   → Clean up formatting
```

**4. ADDING NEW FEATURES**
```
1. mcp__lsmcp__get_project_overview
   → Understand existing architecture
2. mcp__lsmcp__search_symbols --kind "interface"
   → Find relevant interfaces to implement
3. mcp__lsmcp__get_symbol_details --symbol "IUserService"
   → Understand interface requirements
4. mcp__lsmcp__lsp_get_completion --line 50
   → Get suggestions while writing new code
```

**FALLBACK TOOLS (USE ONLY WHEN NECESSARY):**

- ⚠️ `Read` - Only when you need to see non-code files or LSMCP tools fail
- ⚠️ `Grep` - For text pattern searches in files
- ⚠️ `Glob` - Only when LSMCP file finding doesn't work
- ⚠️ `LS` - Only for basic directory listing when LSMCP fails
- ⚠️ `Bash` commands - Only for non-code operations or troubleshooting

### WHEN TO USE FALLBACK TOOLS

Use standard tools ONLY in these situations:

1. **Non-code files**: README, documentation, configuration files
2. **LSMCP tool failures**: When LSMCP tools return errors or no results
3. **Debugging**: When troubleshooting why LSMCP tools aren't working
4. **Special file formats**: Files that LSMCP doesn't support
5. **Quick verification**: Double-checking LSMCP results when needed

## Memory System

You have access to project memories stored in `.lsmcp/memories/`. Use these tools:

- `mcp__lsmcp__list_memories` - List available memory files
- `mcp__lsmcp__read_memory` - Read specific memory content
- `mcp__lsmcp__write_memory` - Create or update memories
- `mcp__lsmcp__delete_memory` - Delete a memory file

Memories contain important project context, conventions, and guidelines that help maintain consistency.

</details>

## Available Presets

lsmcp includes built-in presets for popular language servers:

- **`tsgo`** - TypeScript (Recommended)
- **`typescript`** - typescript-language-server
- **`rust-analyzer`** - Rust Analyser
- **`moonbit`** - MoonBit
- **`fsharp`** - F# (fsautocomplete)
- **`deno`** - Deno TypeScript/JavaScript
- **`gopls`** - Go (Official Go language server)
- **`hls`** - Haskell Language Server (requires ghcup setup, see [docs/HASKELL_SETUP.md](docs/HASKELL_SETUP.md))
- **`ocaml`** - OCaml Language Server

### Configuration

`.lsmcp/config.json`

```json
{
  "$schema": "../node_modules/@mizchi/lsmcp/lsmcp.schema.json",
  "preset": "tsgo",
  "settings": {
    "autoIndex": true,
    "indexConcurrency": 10
  }
}
```

For a comprehensive configuration example, see [examples/full-lsmcp-config.json](examples/full-lsmcp-config.json).

## Tools

lsmcp provides comprehensive MCP tools for code analysis and manipulation:

Note: Tool names listed below are the raw MCP tool names (snake_case, e.g. get_hover). Some clients display them with a server-qualified prefix (e.g. mcp**lsmcp**get_hover). For naming conventions and module boundaries, see [`docs/TOOL_REFERENCE.md`](docs/TOOL_REFERENCE.md).

### Core LSP Tools

- **lsp_get_hover** - Get type information and documentation for symbols
- **lsp_find_references** - Find all references to a symbol across the codebase
- **lsp_get_definitions** - Navigate to symbol definitions with optional code body
- **lsp_get_diagnostics** - Check for errors and warnings in files
- **lsp_get_all_diagnostics** - Get diagnostics for entire project
- **lsp_get_document_symbols** - List all symbols in a file
- **lsp_get_workspace_symbols** - Search symbols across the entire workspace
- **lsp_get_completion** - Get code completion suggestions
- **lsp_get_signature_help** - Get parameter hints for function calls
- **lsp_format_document** - Format entire documents using language server
- **lsp_rename_symbol** - Rename symbols across the codebase
- **lsp_get_code_actions** - Get available quick fixes and refactorings
- **lsp_delete_symbol** - Delete a symbol and optionally all its references
- **lsp_check_capabilities** - Check supported LSP features

### High-Level Tools

- **get_project_overview** - Quick project structure and component analysis
- **search_symbols** - Fast symbol search using pre-built index (auto-creates index if needed)
- **get_symbol_details** - Get comprehensive details about a symbol (hover, definition, references)

### External Library Tools

- **index_external_libraries** - Index TypeScript declaration files from node_modules
- **get_typescript_dependencies** - List available TypeScript dependencies
- **search_external_library_symbols** - Search symbols in indexed external libraries
- **resolve_symbol** - Resolve symbols to their definitions in external libraries
- **get_available_external_symbols** - Get symbols available from imported libraries
- **parse_imports** - Parse and analyze import statements

### Code Editing Tools

- **replace_range** - Replace specific text ranges in files
- **replace_regex** - Advanced regex-based replacements

### File System Tools

- **list_dir** - List directories with gitignore support
- **get_symbols_overview** - High-level symbol overview by file

### Memory Management

- **list_memories** - List project memories
- **read_memory** - Read specific memory content
- **write_memory** - Create or update memories
- **delete_memory** - Remove memories

## Performance Optimization

LSMCP includes several performance optimizations:

- **Incremental Indexing**: Only modified files are re-indexed
- **Memory Monitoring**: Automatic garbage collection when memory usage is high
- **Batch Processing**: Efficient concurrent file processing
- **Smart Caching**: 15-minute cache for frequently accessed data

Configuration options in `.lsmcp/config.json`:
```json
{
  "indexConcurrency": 5,
  "maxFileSize": 10485760,
  "enableWatchers": true,
  "memoryLimit": 1024
}
```

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development setup, testing instructions, and contribution guidelines.

```bash
# Quick start
pnpm install
pnpm build
pnpm test

# Run with memory monitoring
node --expose-gc dist/lsmcp.js
```

### Debug Logging

LSMCP has separate logging systems for MCP server and LSP client that can be controlled independently:

#### MCP Server Logging
Enable MCP server debug output with either environment variable:
```bash
MCP_DEBUG=1 lsmcp       # Enable MCP server debug logging
LSMCP_DEBUG=1 lsmcp     # Alternative (backward compatible)
```

#### LSP Client Logging  
Enable LSP client debug output separately:
```bash
LSP_DEBUG=1 lsmcp       # Enable LSP client debug logging
```

#### Combined Logging
Enable both MCP and LSP debug output:
```bash
MCP_DEBUG=1 LSP_DEBUG=1 lsmcp
```

## License

MIT - See [LICENSE](LICENSE) file for details.
