---
created: 2025-08-04T06:34:42.457Z
updated: 2025-08-04T06:34:42.457Z
---

# Development Commands

## Build and Development
- `pnpm build` - Build the project (required before testing)
- `pnpm watch` - Build in watch mode
- `pnpm typecheck` - Run type checking with tsgo (fast)
- `pnpm typecheck:tsc` - Run type checking with tsc (slower but complete)

## Code Quality
- `pnpm lint` - Run linter (OxLint with --quiet flag)
- `pnpm format` - Format code with Biome
- `pnpm format:check` - Check code formatting without modifying

## Testing
- `pnpm test` - Run all unit and integration tests
- `pnpm test:unit` - Run unit tests only
- `pnpm test:integration` - Run integration tests (builds first)
- `pnpm test:adapters` - Run language adapter tests (local only)
- `pnpm test:watch` - Run tests in watch mode
- `pnpm coverage` - Generate test coverage report

## Git and Version Control
- `git status` - Check current changes
- `git add .` - Stage all changes
- `git commit -m "message"` - Commit with conventional commit format
- `git push` - Push to remote
- `pnpm changelog` - Generate changelog from commits

## MCP/LSP Specific
- `npx tsx src/mcp/lsmcp.ts` - Run MCP server directly
- `./dist/lsmcp.js` - Run built MCP server
- `pnpm test:examples` - Test example configurations

## System Commands
- `ls -la` - List files with details
- `cat file` - Display file contents
- `grep -r "pattern" .` - Search for pattern in files
- `find . -name "*.ts"` - Find TypeScript files
- `rg "pattern"` - Use ripgrep for fast searching (recommended)

## Debugging
- Set `DEBUG=lsmcp:*` environment variable for debug output
- Check `.lsmcp/cache/` for symbol cache database
- Review `fsac.log` for F# language server logs