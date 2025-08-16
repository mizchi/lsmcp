---
created: 2025-08-16T16:23:18.179Z
updated: 2025-08-16T16:23:18.179Z
---

# Code Style and Conventions

## TypeScript Conventions
- **File Naming**: lowerCamelCase (e.g., `symbolIndex.ts`, `lspClient.ts`)
- **Import Extensions**: Always add `.ts` extension to imports for Deno compatibility
  - Example: `import { foo } from "./bar.ts"`
- **Type Definitions**: Prefer `interface` over `type` for object definitions
- **Async Code**: Use `async/await` over raw promises
- **Strict Mode**: TypeScript strict mode is enabled
  - `noImplicitAny: true`
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`

## Code Formatting (Biome)
- **Indent Style**: Spaces
- **Indent Width**: 2 spaces
- **Quote Style**: Double quotes for JavaScript/TypeScript strings
- **Semicolons**: Required
- **Trailing Commas**: Preferred for multi-line structures

## Documentation Language
- **IMPORTANT**: All documentation, comments, and code should be in English
- This includes:
  - Code comments
  - Documentation files (README, TODO, etc.)
  - Commit messages
  - Variable and function names
  - Error messages and logs

## Module System
- ES Modules (type: "module" in package.json)
- Use named exports for better tree-shaking
- Default exports are acceptable for main entry points

## Testing Conventions
- Test files named with `.test.ts` suffix
- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Language-specific tests in `tests/languages/`

## Error Handling
- Use `neverthrow` for functional error handling where appropriate
- Provide descriptive error messages
- Log errors appropriately for debugging

## LSP/MCP Specific
- Tool names use snake_case (e.g., `get_hover`, `find_references`)
- MCP tools may be prefixed by client (e.g., `mcp__lsmcp__get_hover`)
- Symbol kinds follow LSP specification numbers

## Git Conventions
- Conventional commits format: `type(scope): description`
  - Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `perf`
- Branch naming: `fix/issue-name` or `feat/feature-name`
- Target main branch for pull requests

## Configuration Files
- `.lsmcp/config.json` - LSP/MCP configuration
- `tsconfig.json` - TypeScript configuration
- `biome.json` - Formatter configuration
- `vitest.config.ts` - Test configuration