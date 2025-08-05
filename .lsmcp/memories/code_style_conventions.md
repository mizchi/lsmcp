---
created: 2025-08-05T08:16:17.815Z
updated: 2025-08-05T08:16:17.815Z
---

# Code Style and Conventions

## Language Requirements
- **All code, comments, and documentation must be in English**
- This ensures global accessibility and consistency

## File Naming
- Use **lowerCamelCase** for TypeScript files (e.g., `symbolIndex.ts`, `lspClient.ts`)
- Adapter files use lowerCamelCase (e.g., `typescriptLanguageServer.ts`, `rustAnalyzer.ts`)
- Test files follow pattern: `<name>.test.ts`

## Import Style
- **Always add `.ts` extension to imports** for Deno compatibility
  - ✅ `import { foo } from "./bar.ts"`
  - ❌ `import { foo } from "./bar"`
- Use TypeScript consistent type imports:
  - `import type { Foo } from "./types.ts"`
  - `import { type Bar, baz } from "./module.ts"`

## TypeScript Conventions
- **Use strict mode** (enabled in tsconfig.json)
- **Prefer `interface` over `type`** for object definitions
- **Use `async/await`** over raw promises
- Avoid `any` type - use `unknown` or specific types
- Use underscore prefix for unused variables: `_unusedVar`

## Naming Conventions
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_TIMEOUT`)
- **Interfaces**: PascalCase with descriptive names
- **Functions**: camelCase, verb-based (e.g., `getDefinitions`, `findReferences`)
- **Variables**: camelCase, noun-based
- **Private fields**: underscore prefix (e.g., `_privateField`)

## Code Organization
- Group related imports together
- Order: external deps, internal deps, types
- Keep functions focused and single-purpose
- Max complexity per function: 7 (enforced by linter)

## Error Handling
- Use `neverthrow` Result types for recoverable errors
- Throw only for unrecoverable errors
- Always handle promises (no floating promises)
- Use descriptive error messages

## Documentation
- Document complex logic with inline comments
- Use JSDoc for public APIs
- Keep comments concise and relevant
- Update comments when code changes

## Testing
- Write tests for new features
- Test file location mirrors source structure
- Use descriptive test names
- Mock external dependencies

## Git Conventions
- **Commit messages**: Use conventional commits
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation
  - `refactor:` for code refactoring
  - `test:` for test changes
  - `chore:` for maintenance
- **Branch naming**: `fix/issue-name` or `feat/feature-name`
- Target `main` branch for PRs

## Formatting
- **Indentation**: 2 spaces (enforced by Biome)
- **Quotes**: Double quotes for strings
- **Semicolons**: Required
- **Line length**: Reasonable (no hard limit)
- Run `pnpm format` before committing