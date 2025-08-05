---
created: 2025-08-05T08:16:35.139Z
updated: 2025-08-05T08:16:35.139Z
---

# Task Completion Checklist

When completing any coding task in the lsmcp project, follow this checklist:

## Before Starting
1. Read relevant memory files for context
2. Check `.lsmcp/config.json` for current configuration
3. Use `pnpm typecheck` to ensure baseline type safety

## During Development
1. Follow code style conventions (see code_style_conventions.md)
2. Add `.ts` extension to all imports
3. Use English for all code, comments, and documentation
4. Prefer interfaces over types for objects
5. Use async/await instead of raw promises

## After Making Changes
1. **Run type checking**
   - `pnpm typecheck` - Fast check with tsgo
   - `pnpm typecheck:tsc` - Comprehensive check if needed

2. **Run linting**
   - `pnpm lint` - Check for code quality issues
   - Fix any errors or warnings

3. **Format code**
   - `pnpm format` - Auto-format with Biome
   - Ensure consistent code style

4. **Run tests**
   - `pnpm test:unit` - Quick unit test feedback
   - `pnpm build` - MUST build before integration tests
   - `pnpm test:integration` - Test MCP functionality
   - `pnpm test` - Run all tests

## Before Committing
1. Ensure all tests pass
2. Check `git status` for unintended changes
3. Review changes with `git diff`
4. Write descriptive commit message using conventional commits
5. Do NOT commit unless explicitly asked by user

## Important Reminders
- **NEVER modify timeout settings** in tests
- **ALWAYS run `pnpm build`** before integration tests
- **Use `rg` (ripgrep)** instead of grep for searching
- **Check for console.log** statements (linter will warn)
- **Verify no floating promises** (enforced by linter)

## Common Issues to Check
- Missing `.ts` extensions in imports
- Unused variables (prefix with `_` if intentional)
- Complexity exceeding 7 (refactor if needed)
- Any TypeScript errors or warnings
- Proper error handling with Result types

## Final Verification
Run this sequence to ensure everything is correct:
```bash
pnpm typecheck && pnpm lint && pnpm format && pnpm test
```

If all commands pass, the task is complete!