---
created: 2025-08-16T16:22:59.010Z
updated: 2025-08-16T16:22:59.010Z
---

# Suggested Commands for lsmcp Development

## Build and Development
- `pnpm build` - Build the project (required before running integration tests)
- `pnpm watch` - Watch mode for development
- `pnpm generate-schema` - Generate JSON schema for configuration

## Testing
- `pnpm test` - Run all unit and integration tests
- `pnpm test:unit` - Run unit tests only
- `pnpm test:integration` - Run integration tests (requires build first)
- `pnpm test:languages` - Run language-specific tests (local only)
- `pnpm test:languages:rust` - Test Rust language support specifically
- `pnpm test:watch` - Run tests in watch mode
- `pnpm coverage` - Generate test coverage report

## Code Quality
- `pnpm typecheck` - Type check with tsgo (fast TypeScript checker)
- `pnpm typecheck:tsc` - Type check with native TypeScript compiler
- `pnpm lint` - Run oxlint in quiet mode
- `pnpm lint:refactor` - Run oxlint with detailed output
- `pnpm format` - Format code with Biome
- `pnpm format:check` - Check formatting without changing files

## Rust-specific (for examples/rust-project)
- `cargo build` - Build the Rust project
- `cargo check` - Check for compilation errors
- `cargo test` - Run Rust tests
- `cargo fmt` - Format Rust code
- `cargo clippy` - Run Rust linter

## Git and Version Control
- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- `pnpm changelog` - Generate changelog from commits
- `git` - Standard git commands available

## System Utilities
- `ls` - List directory contents
- `cd` - Change directory
- `rg` (ripgrep) - Fast text search (preferred over grep)
- `find` - Find files and directories

## MCP Server
- `npx @mizchi/lsmcp -p tsgo` - Run lsmcp with tsgo preset
- `npx @mizchi/lsmcp --bin "rust-analyzer"` - Run with rust-analyzer

## Important Notes
- Always run `pnpm build` before integration tests
- Use `rg` instead of `grep` for searching
- The project uses strict TypeScript mode
- Tests may fail if timeouts are insufficient - DO NOT modify timeouts without permission