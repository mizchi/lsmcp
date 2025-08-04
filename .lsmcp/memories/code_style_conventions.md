---
created: 2025-08-04T06:34:26.926Z
updated: 2025-08-04T06:34:26.926Z
---

# Code Style and Conventions

## TypeScript Conventions
- **File Extensions**: Always use `.ts` extension in imports (for Deno compatibility)
  ```typescript
  import { foo } from "./bar.ts";  // ✓ Correct
  import { foo } from "./bar";     // ✗ Wrong
  ```

## Naming Conventions
- **Files**: lowerCamelCase (e.g., `symbolIndex.ts`, `lspClient.ts`)
- **Classes**: PascalCase (e.g., `SymbolIndex`, `LSPClient`)
- **Functions/Methods**: camelCase (e.g., `getSymbols`, `indexFiles`)
- **Constants**: UPPER_SNAKE_CASE or PascalCase for exported constants
- **Interfaces/Types**: PascalCase with descriptive names

## Code Organization
- No inline comments unless explicitly requested
- Prefer interfaces over type aliases for object shapes
- Use `type` imports for type-only imports
- Group imports: external packages → relative imports → type imports

## Error Handling
- Use custom error types extending base error classes
- Always include context in error messages
- Handle errors at appropriate levels (don't catch and rethrow unnecessarily)

## Testing
- Tests are colocated with source files or in `tests/` directory
- Use descriptive test names
- Mock external dependencies appropriately

## Documentation
- JSDoc comments for public APIs
- README files for major modules
- Type definitions should be self-documenting

## Git Commit Convention
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Include emoji and co-author when using AI assistance:
  ```
  🤖 Generated with [Claude Code](https://claude.ai/code)
  
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```