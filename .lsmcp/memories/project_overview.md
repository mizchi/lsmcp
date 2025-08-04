---
created: 2025-08-04T06:34:07.930Z
updated: 2025-08-04T06:34:07.930Z
---

# LSMCP - Language Service MCP

## Project Purpose
lsmcp (Language Service MCP) is a unified Model Context Protocol (MCP) server that provides advanced code manipulation and analysis capabilities for multiple programming languages through Language Server Protocol (LSP) integration. It's designed as "LSP for headless AI Agents" to enable LLMs to perform semantic code analysis and manipulation.

## Tech Stack
- **Language**: TypeScript (ES modules)
- **Runtime**: Node.js v24.4.0
- **Package Manager**: pnpm v9.15.0
- **Build Tool**: tsdown (Rolldown-based bundler)
- **Type Checker**: tsgo (fast TypeScript type checker)
- **Formatter**: Biome
- **Linter**: OxLint
- **Test Framework**: Vitest
- **MCP SDK**: @modelcontextprotocol/sdk
- **LSP Implementation**: vscode-languageserver-protocol

## Main Features
1. **Multi-Language Support** - TypeScript, Python, Rust, Go, F#, MoonBit, Deno
2. **LSP Tools** - Hover, References, Definitions, Diagnostics, Rename, Completion, etc.
3. **Symbol Indexing** - Fast symbol search and token compression analysis
4. **AI-Optimized** - Line and symbol-based interfaces for LLMs

## Architecture
- `src/adapters/` - Language-specific LSP adapters
- `src/core/` - Core utilities and types
- `src/indexer/` - Symbol indexing implementation
- `src/lsp/` - LSP client and tools
- `src/mcp/` - MCP server implementation
- `src/serenity/` - Symbol editing and memory tools

## Entry Point
The main entry point is `src/mcp/lsmcp.ts` which is built to `dist/lsmcp.js`.