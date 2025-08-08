# lsmcp - Language Service Protocol MCP

A unified MCP (Model Context Protocol) server that provides advanced code manipulation and analysis capabilities for multiple programming languages through Language Server Protocol integration.

- 🌍 **Multi-Language Support**
- 🔍 **Semantic Code Analysis**
- 🤖 **AI-Optimized**

See [examples/](examples/) for working examples of each supported language configuration.

## Quick Start

```bash
# Using presets for common languages
npm add -D @mizchi/lsmcp @typescript/native-preview
npx @mizchi/lsmcp init -p tsgo
claude mcp add lsmcp npx -- -y @mizchi/lsmcp -p tsgo

# with manual --bin
claude mcp add lsmcp npx -- -y @mizchi/lsmcp --bin="<lsp-command>"
```

<details>
<summary>📖 Example Usage with Claude</summary>

### Basic Workflow

```
You: Start onboarding with lsmcp
Claude: [Initializes lsmcp and creates symbol index]

You: Get project overview
Claude: [Analyzes project structure and shows key components]

You: Find all references to the "handleRequest" function
Claude: [Searches index and shows all usage locations]

You: Show me the implementation of the UserService class
Claude: [Navigates to definition with full code body]
```

### Common Tasks

```
# Search for symbols
You: Find all classes that implement the Repository interface

# Code navigation
You: Where is the authentication logic implemented?

# Error checking
You: Check for TypeScript errors in the src directory

# Code editing
You: Replace all console.log with logger.debug in the codebase

# Project understanding
You: What are the main components of this application?
```

</details>

## Available Presets

lsmcp includes built-in presets for popular language servers:

- **`tsgo`** - TypeScript (Recommended)
- **`typescript`** - typescript-language-server
- **`rust-analyzer`** - Rust Analyser
- **`moonbit`** - MoonBit
- **`fsharp`** - F# (fsautocomplete)
- **`rust-analyzer`** - Rust
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

Available configuration options:

- **preset** - Preset language adapter (tsgo, typescript, rust-analyzer, pyright, gopls, etc.)
- **indexFiles** - Glob patterns for files to index
- **lsp** - Custom LSP server configuration (bin, args, initializationOptions)
- **settings** - LSMCP settings (autoIndex, indexConcurrency, enableWatchers, etc.)
- **symbolFilter** - Symbol filtering options (excludeKinds, excludePatterns)
- **ignorePatterns** - Additional patterns to ignore during indexing

See the complete schema at `node_modules/@mizchi/lsmcp/lsmcp.schema.json` after installation.

For a comprehensive configuration example, see [examples/full-lsmcp-config.json](examples/full-lsmcp-config.json).

## Tools

lsmcp provides comprehensive MCP tools for code analysis and manipulation:

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

### Workflow Tools

- **check_index_onboarding** - Check onboarding status
- **index_onboarding** - Get onboarding instructions
- **get_symbol_search_guidance** - Learn effective search techniques
- **get_compression_guidance** - Token compression analysis

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development setup, testing instructions, and contribution guidelines.

```bash
# Quick start
pnpm install
pnpm build
pnpm test
```

## License

MIT - See [LICENSE](LICENSE) file for details.
