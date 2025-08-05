---
created: 2025-08-05T08:15:56.528Z
updated: 2025-08-05T08:15:56.528Z
---

# Suggested Commands for lsmcp Development

## Build & Development
- `pnpm build` - Build the project (MUST run before integration tests)
- `pnpm watch` - Build in watch mode for development
- `pnpm typecheck` - Type check with tsgo (fast)
- `pnpm typecheck:tsc` - Type check with tsc (slower but comprehensive)

## Testing
- `pnpm test` - Run all unit and integration tests
- `pnpm test:unit` - Run unit tests only
- `pnpm test:integration` - Run integration tests (requires build first!)
- `pnpm test:adapters` - Test language adapters (local only)
- `pnpm test:watch` - Run tests in watch mode
- `pnpm coverage` - Generate test coverage report

## Code Quality
- `pnpm lint` - Run oxlint (quiet mode)
- `pnpm lint:refactor` - Run oxlint with all warnings
- `pnpm format` - Format code with Biome
- `pnpm format:check` - Check formatting without changes

## Language-Specific Tests
- `pnpm test:adapters:fsharp` - Test F# adapter
- `pnpm test:adapters:rust` - Test Rust adapter
- `pnpm test:adapters:tsgo` - Test tsgo adapter
- `pnpm test:adapters:python` - Test Python adapter
- `pnpm test:adapters:moonbit` - Test MoonBit adapter

## Utility Commands
- `pnpm test:examples` - Check example projects
- `pnpm build:supported-table` - Generate LSP support table
- `pnpm changelog` - Generate changelog
- `pnpm version` - Bump version and update changelog

## Git & System Commands
- `git status` - Check repository status
- `git diff` - View unstaged changes
- `git log --oneline -10` - View recent commits
- `rg <pattern>` - Search code with ripgrep (use instead of grep)
- `ls -la` - List files with details

## Development Workflow
1. Make changes to source code
2. Run `pnpm typecheck` to check types
3. Run `pnpm lint` to check code quality
4. Run `pnpm format` to format code
5. Run `pnpm test:unit` for fast feedback
6. Run `pnpm build` before integration tests
7. Run `pnpm test:integration` to test MCP functionality
8. Run `pnpm test` to ensure all tests pass

## Important Notes
- ALWAYS run `pnpm build` before running integration tests
- Use `rg` (ripgrep) instead of `grep` for searching
- Integration tests require built artifacts in dist/
- Adapter tests require language servers to be installed