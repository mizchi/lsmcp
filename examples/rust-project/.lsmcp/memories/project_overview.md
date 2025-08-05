---
created: 2025-08-05T01:33:58.251Z
updated: 2025-08-05T01:33:58.251Z
---

# Rust Example Project Overview

## Purpose
This is an example project demonstrating how to use lsmcp (Language Service MCP) with Rust projects using rust-analyzer. It serves as a reference implementation for integrating MCP tools with Rust development workflows.

## Tech Stack
- **Language**: Rust (Edition 2021)
- **LSP Server**: rust-analyzer
- **Build Tool**: Cargo
- **MCP Server**: lsmcp with rust-analyzer adapter
- **Dependencies**: None (standard library only)

## Project Structure
```
rust-project/
├── Cargo.toml          # Project configuration
├── Cargo.lock          # Dependency lock file
├── README.md           # Project documentation
├── .lsmcp/             # LSMCP configuration
│   └── config.json     # LSP adapter and indexing settings
├── src/
│   ├── main.rs         # Main entry point with usage examples
│   ├── lib.rs          # Library with Calculator struct and greet function
│   ├── errors.rs       # File with intentional errors for testing diagnostics
│   └── test_diagnostics.rs  # Additional diagnostic testing
└── target/             # Build artifacts (gitignored)
```

## Key Features
- Calculator struct with basic arithmetic operations
- Simple greeting function for demonstration
- Unit tests included in lib.rs
- Intentional error examples for testing LSP diagnostics

## Integration with lsmcp
The project is configured to work with lsmcp MCP server using rust-analyzer as the language server backend. This enables advanced IDE-like features through MCP tools for code analysis, refactoring, and navigation.