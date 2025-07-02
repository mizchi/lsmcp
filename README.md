# lsmcp - Language Service MCP

**LSP for headless AI Agents**

> ⚠️ **This project is under active development.** APIs and features may change without notice.

A unified MCP (Model Context Protocol) server that provides advanced code manipulation and analysis capabilities for multiple programming languages through Language Server Protocol integration.

## Features

- 🌍 **Multi-Language Support** - Built-in TypeScript/JavaScript, extensible to any language via LSP
- 🔍 **Semantic Code Analysis** - Go to definition, find references, type information
- 🤖 **AI-Optimized** - Designed for LLMs with line and symbol-based interfaces

### LSP Tools (Language Server Protocol)

These tools work with any language that has an LSP server:

- **get_hover** - Get hover information (type signature, documentation) using LSP
- **find_references** - Find all references to symbol across the codebase using LSP
- **get_definitions** - Get the definition(s) of a symbol using LSP
- **get_diagnostics** - Get diagnostics (errors, warnings) for a file using LSP
- **get_all_diagnostics** - Get diagnostics (errors, warnings) for all files in the project
- **rename_symbol** - Rename a symbol across the codebase using Language Server Protocol
- **delete_symbol** - Delete a symbol and optionally all its references using LSP
- **get_document_symbols** - Get all symbols (functions, classes, variables, etc.) in a document using LSP
- **get_workspace_symbols** - Search for symbols across the entire workspace using LSP
- **get_completion** - Get code completion suggestions at a specific position using LSP
- **get_signature_help** - Get signature help (parameter hints) for function calls using LSP
- **get_code_actions** - Get available code actions (quick fixes, refactorings, etc.) using LSP
- **format_document** - Format an entire document using the language server's formatting provider

> **Note**: TypeScript tools use the TypeScript Compiler API directly and don't require an LSP server. LSP tools require a running Language Server for your target language.

See [Tool Reference](docs/TOOL_REFERENCE.md) for detailed documentation.

Note: When using `--language typescript`, both LSP tools and TypeScript-specific tools are available.

See [Language Support Matrix](docs/LANGUAGE_SUPPORT_MATRIX.md) for detailed information about available tools for each language.

See [examples/](examples/) for working examples of each supported language configuration.

## Quick Start

lsmcp provides multi-language support through Language Server Protocol (LSP) integration. The basic workflow is:

1. **Install Language Server** - Install the LSP server for your target language
2. **Add MCP Server** - Configure using `claude mcp add` command or `.mcp.json`

### Basic Usage

```bash
# Basic pattern: Specify LSP server with --bin
claude mcp add <server-name> npx -- -y @mizchi/lsmcp --bin="<lsp-command>"
claude mcp add typescript npx -- -y @mizchi/lsmcp --language=typescript
```

### Language-Specific Setup

#### TypeScript

<details>
<summary>TypeScript Setup</summary>

```bash
# with typeScript-language-server (stable)
npm add -D typescript typescript-language-server
# Recommended: use tsgo for full functionality
claude mcp add typescript npx -- -y @mizchi/lsmcp --language=typescript --bin="npx tsgo --lsp --stdio"

# with @typescript/native-preview (experimental, fast)
npm add -D @typescript/native-preview
claude mcp add typescript npx -- -y @mizchi/lsmcp --language=typescirpt --bin="npx tsgo"
```

Manual Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "typescript": {
      "command": "npx",
      "args": [
        "-y",
        "@mizchi/lsmcp",
        "--language",
        "typescript",
        "--bin",
        "npx tsgo --lsp --stdio"
      ]
    }
  }
}
```

</details>

#### Rust

<details>
<summary>Rust Setup</summary>

```bash
rustup component add rust-analyzer
claude mcp add rust npx -- -y @mizchi/lsmcp --bin="rust-analyzer"
```

Manual Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "rust": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--bin", "rust-analyzer"]
    }
  }
}
```

See [examples/rust-project/](examples/rust-project/) for a complete example.

</details>

#### F#

<details>
<summary>F# Setup</summary>

```bash
dotnet tool install -g fsautocomplete
claude mcp add fsharp npx -- -y @mizchi/lsmcp --language=fsharp --bin="fsautocomplete --adaptive-lsp-server-enabled"
```

Manual Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "fsharp": {
      "command": "npx",
      "args": [
        "-y",
        "@mizchi/lsmcp",
        "--language",
        "fsharp",
        "--bin",
        "fsautocomplete"
      ]
    }
  }
}
```

See [examples/fsharp-project/](examples/fsharp-project/) for a complete example.

</details>

#### Python

<details>
<summary>Python Setup</summary>

```bash
pip install python-lsp-server
claude mcp add python npx -- -y @mizchi/lsmcp --bin="pylsp"
```

Manual Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "python": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--bin", "pylsp"]
    }
  }
}
```

See [examples/python-project/](examples/python-project/) for a complete example.

</details>

#### Other Languages

<details>
<summary>Other Language Support</summary>

lsmcp supports any language with an LSP server. Here are some common configurations:

```bash
# Go
go install golang.org/x/tools/gopls@latest
claude mcp add go npx -- -y @mizchi/lsmcp --bin="gopls"

# C/C++
apt install clangd  # Ubuntu/Debian
brew install llvm   # macOS
claude mcp add cpp npx -- -y @mizchi/lsmcp --bin="clangd"

# Java (download eclipse.jdt.ls from https://download.eclipse.org/jdtls/)
claude mcp add java npx -- -y @mizchi/lsmcp --bin="jdtls"

# Ruby
gem install solargraph
claude mcp add ruby npx -- -y @mizchi/lsmcp --bin="solargraph stdio"
```

</details>

## MCP Usage

### Command Line Options

```bash
# TypeScript/JavaScript (built-in support)
npx @mizchi/lsmcp --language typescript

# Other languages via LSP server
npx @mizchi/lsmcp --bin rust-analyzer
npx @mizchi/lsmcp --bin "deno lsp"  # Multi-word commands

# Specify project root
npx @mizchi/lsmcp --project-root /path/to/project

# Debug mode
npx @mizchi/lsmcp --verbose
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

See [CLAUDE.md](CLAUDE.md) for development guidelines.

## Troubleshooting

<details>
<summary>Common Issues</summary>

### LSP Server Not Found

```
Error: LSP server for typescript not found
```

**Solution**: Install the language server:

```bash
npm add typescript typescript-language-server
```

### Permission Denied

```
Error: Permission denied for tool 'rename_symbol'
```

**Solution**: Update `.claude/settings.json` to allow lsmcp tools.

### Empty Diagnostics

If `get_diagnostics` returns empty results:

1. Ensure the language server is running: `ps aux | grep language-server`
2. Check for tsconfig.json or equivalent config file
3. Try opening the file first with `get_hover`

### Debugging

Enable verbose logging:

```bash
npx @mizchi/lsmcp --verbose
```

Check language server output:

```bash
# Run language server directly
typescript-language-server --stdio
```

</details>

## License

MIT - See [LICENSE](LICENSE) file for details.

## Recent Updates

- **v0.5.2** (2025-01-29) - Consolidated TypeScript tools, removed duplicates in favor of LSP implementations
- **v0.5.1** - Added F# language support with dedicated initialization
- **v0.5.0** - Unified lsmcp CLI for all languages

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.
