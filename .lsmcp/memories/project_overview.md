---
created: 2025-08-05T08:15:35.164Z
updated: 2025-08-05T08:15:35.164Z
---

# lsmcp Project Overview

## Purpose
lsmcp (Language Service MCP) is a unified Model Context Protocol (MCP) server that provides advanced code manipulation and analysis capabilities for multiple programming languages through Language Server Protocol (LSP) integration. It's designed to be "LSP for headless AI Agents", enabling AI assistants to perform semantic code analysis, navigation, and manipulation.

## Key Features
- Multi-language support via LSP adapters
- Semantic code analysis (go to definition, find references, type information)
- AI-optimized design with line and symbol-based interfaces
- Symbol indexing for fast searches
- Memory system for project context

## Tech Stack
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js with ESM modules
- **Package Manager**: pnpm (v9.15.0)
- **Build Tool**: tsdown (Rolldown-based bundler)
- **Type Checking**: tsgo (fast TypeScript type checker)
- **Linter**: oxlint
- **Formatter**: Biome
- **Testing**: Vitest
- **Core Dependencies**:
  - @modelcontextprotocol/sdk - MCP implementation
  - vscode-languageserver-protocol - LSP client implementation
  - zod - Schema validation
  - neverthrow - Result type handling

## Project Structure
```
lsmcp/
├── src/
│   ├── adapters/      - Language-specific LSP adapters
│   ├── cli/           - CLI implementation
│   ├── constants/     - Constants and defaults
│   ├── core/          - Core functionality (config, logging, etc.)
│   ├── indexer/       - Symbol indexing system
│   ├── lsp/           - LSP client and tools
│   ├── mcp/           - MCP server implementation
│   ├── prompts/       - AI prompts and guidance
│   ├── ts/            - TypeScript-specific utilities
│   └── types/         - TypeScript type definitions
├── tests/             - Unit and integration tests
├── examples/          - Example projects for each language
├── scripts/           - Build and utility scripts
└── .lsmcp/           - Project configuration and memories
```

## Version
Current version: 0.9.0-rc.2 (Release Candidate)