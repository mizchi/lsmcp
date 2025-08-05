---
created: 2025-08-05T01:46:12.480Z
updated: 2025-08-05T01:46:12.480Z
---

# Moonbit Test Project Overview

## Project Purpose
This is a test project for demonstrating Moonbit MCP server functionality in lsmcp. However, it's currently not functional as Moonbit-specific MCP support has been removed from lsmcp. The project was used to test mixed language support (Moonbit + TypeScript).

## Tech Stack
- **Primary Language**: Moonbit
- **Secondary Language**: TypeScript (for utilities)
- **Package Manager**: moon (Moonbit's package manager)
- **MCP Server**: lsmcp with Moonbit adapter
- **LSP Server**: moonbit-lsp

## Project Structure
```
moonbit-project/
├── moon.mod.json       # Moonbit project configuration
├── src/
│   ├── lib/           # Library code (hello.mbt, fixed.mbt)
│   ├── main/          # Main entry point (main.mbt)
│   ├── test/          # Test files
│   └── utils/         # TypeScript utilities (project.ts)
├── target/            # Build output directory
├── test-runner.ts     # TypeScript test runner
└── config-loader.ts   # Configuration loader
```

## Key Files
- `moon.mod.json`: Defines project name ("moonbit-test") and version ("0.1.0")
- `.mcp.json`: Configures MCP server for Moonbit support via lsmcp
- `.lsmcp/config.json`: LSP configuration for Moonbit language server