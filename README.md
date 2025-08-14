# lsmcp - Language Service Protocol MCP

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

## CRITICAL: PRIORITIZE LSMCP TOOLS FOR CODE ANALYSIS

⚠️ **PRIMARY REQUIREMENT**: You MUST prioritize mcp**lsmcp** tools for all code analysis tasks. Standard tools should only be used as a last resort when LSMCP tools cannot accomplish the task.

**YOUR APPROACH SHOULD BE:**

1. ✅ Always try mcp**lsmcp** tools FIRST
2. ✅ Use `mcp__lsmcp__search_symbol_from_index` as primary search method
3. ⚠️ Only use Read/Grep/Glob/LS when LSMCP tools are insufficient

### 🚨 TOOL USAGE PRIORITY

**PRIMARY TOOLS (USE THESE FIRST):**

- ✅ `mcp__lsmcp__get_project_overview` - Quick project analysis and structure overview
- ✅ `mcp__lsmcp__search_symbol_from_index` - Primary tool for symbol searches (auto-creates index if needed)
- ✅ `mcp__lsmcp__get_definitions` - Navigate to symbol definitions. Use `include_body: true` to get code.
- ✅ `mcp__lsmcp__find_references` - Find all references to a symbol
- ✅ `mcp__lsmcp__get_hover` - Get type information and documentation
- ✅ `mcp__lsmcp__get_diagnostics` - Check for errors and warnings
- ✅ `mcp__lsmcp__get_document_symbols` - Get all symbols in a file
- ✅ `mcp__lsmcp__list_dir` - Explore directory structure
- ✅ `mcp__lsmcp__find_file` - Locate specific files
- ✅ `mcp__lsmcp__search_for_pattern` - Search for text patterns
- ✅ `mcp__lsmcp__get_index_stats_from_index` - View index statistics
- ✅ `mcp__lsmcp__index_files` - Manually index files (optional)
- ✅ `mcp__lsmcp__clear_index` - Clear and rebuild index (optional)

### WORKFLOW

1. **START WITH PROJECT OVERVIEW**

   ```
   mcp__lsmcp__get_project_overview
   ```

   Get a quick understanding of:

   - Project structure and type
   - Key components (interfaces, functions, classes)
   - Statistics and dependencies
   - Directory organization

2. **SEARCH FOR SPECIFIC SYMBOLS**

   ```
   mcp__lsmcp__search_symbol_from_index
   ```

   The tool automatically:

   - Creates index if it doesn't exist
   - Updates index with incremental changes
   - Performs your search

3. **CODE EXPLORATION**

   - Search symbols: `mcp__lsmcp__search_symbol_from_index`
   - List directories: `mcp__lsmcp__list_dir`
   - Find files: `mcp__lsmcp__find_file`
   - Get file symbols: `mcp__lsmcp__get_document_symbols`

4. **CODE ANALYSIS**
   - Find definitions: `mcp__lsmcp__get_definitions`
   - Find references: `mcp__lsmcp__find_references`
   - Get type info: `mcp__lsmcp__get_hover`
   - Check errors: `mcp__lsmcp__get_diagnostics`

**FALLBACK TOOLS (USE ONLY WHEN NECESSARY):**

- ⚠️ `Read` - Only when you need to see non-code files or LSMCP tools fail
- ⚠️ `Grep` - Only for quick searches when LSMCP search is insufficient
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

- `list_memories` - List available memory files
- `read_memory` - Read specific memory content
- `write_memory` - Create or update memories

Memories contain important project context, conventions, and guidelines that help maintain consistency.

The context and modes of operation are described below. From them you can infer how to interact with your user
and which tasks and kinds of interactions are expected of you.

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

- **get_hover** - Get type information and documentation for symbols
- **find_references** - Find all references to a symbol across the codebase
- **get_definitions** - Navigate to symbol definitions with optional code body
- **get_diagnostics** - Check for errors and warnings in files
- **get_all_diagnostics** - Get diagnostics for entire project
- **get_document_symbols** - List all symbols in a file
- **get_workspace_symbols** - Search symbols across the entire workspace
- **get_completion** - Get code completion suggestions
- **get_signature_help** - Get parameter hints for function calls
- **format_document** - Format entire documents using language server
- **check_capabilities** - Check supported LSP features

### Symbol Index Tools

- **index_symbols** - Smart incremental indexing with auto-updates
- **search_symbol_from_index** - Fast symbol search using pre-built index
- **get_index_stats_from_index** - View index statistics and performance
- **clear_index** - Clear and rebuild symbol index
- **get_project_overview** - Quick project structure and component analysis

### Code Editing Tools

- **replace_symbol_body** - Replace entire symbol implementations
- **insert_before_symbol** - Insert code before symbols
- **insert_after_symbol** - Insert code after symbols
- **replace_regex** - Advanced regex-based replacements

### File System Tools

- **list_dir** - List directories with gitignore support
- **find_file** - Find files by pattern
- **search_for_pattern** - Search text patterns in codebase
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
