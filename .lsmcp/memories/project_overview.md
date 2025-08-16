---
created: 2025-08-16T16:22:42.833Z
updated: 2025-08-16T16:22:42.833Z
---

# lsmcp Project Overview

## Purpose
lsmcp (Language Service Protocol MCP) is a unified Model Context Protocol server that provides advanced code manipulation and analysis capabilities for multiple programming languages through Language Server Protocol integration.

## Tech Stack
- **Language**: TypeScript (ES modules)
- **Runtime**: Node.js
- **Package Manager**: pnpm (9.15.0)
- **Build Tool**: tsdown (Rolldown-based bundler)
- **Testing**: Vitest (unit, integration, language tests)
- **Linting**: oxlint
- **Type Checking**: tsgo (TypeScript Go-based checker)
- **Formatting**: Biome
- **Core Dependencies**:
  - @modelcontextprotocol/sdk - MCP implementation
  - vscode-languageserver-protocol - LSP client implementation
  - zod - Schema validation

## Project Structure
```
lsmcp/
├── src/              # Main source code
├── packages/         # Internal packages
│   ├── code-indexer/ # Symbol indexing functionality
│   ├── lsp-client/   # LSP client implementation
│   └── types/        # Shared TypeScript types
├── tests/            # Test files
│   ├── unit/         # Unit tests
│   ├── integration/  # Integration tests
│   └── languages/    # Language-specific tests
├── examples/         # Example projects for different languages
│   ├── rust-project/ # Current working directory (Rust example)
│   └── ...          # Other language examples
└── scripts/          # Build and utility scripts
```

## Current Working Directory
We are currently in `/home/mizchi/mizchi/lsmcp/examples/rust-project/` which is a Rust example project demonstrating how to use lsmcp with rust-analyzer.

### Rust Project Structure
```
rust-project/
├── src/
│   ├── main.rs           # Main entry point
│   ├── lib.rs            # Library with Calculator struct and greet function
│   ├── errors.rs         # File with intentional errors for testing
│   └── test_diagnostics.rs # Various diagnostic test cases
├── Cargo.toml            # Rust project configuration
└── README.md             # Usage documentation
```

## Version
- lsmcp: v0.10.0-rc.3
- TypeScript/Native: 7.0.0-dev
- Node.js environment on Linux