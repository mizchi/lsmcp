---
created: 2025-08-04T06:34:55.727Z
updated: 2025-08-04T06:34:55.727Z
---

# Task Completion Checklist

When completing any code modification task, always run these commands:

## 1. Format Code (Automatic in pre-commit hook)
```bash
pnpm format
# or
pnpm biome format --write src/ tests/
```

## 2. Type Check
```bash
pnpm typecheck
```

## 3. Lint
```bash
pnpm lint
```

## 4. Run Tests
```bash
# For quick validation
pnpm test:unit

# For thorough validation
pnpm test
```

## 5. Build
```bash
pnpm build
```

## Pre-commit Hook
The project has a Husky pre-commit hook that automatically:
1. Checks code formatting (fails if not formatted)
2. Runs linting
3. Runs type checking

If the hook fails:
- For formatting errors: Run `pnpm biome format --write src/ tests/`
- For lint errors: Fix the reported issues
- For type errors: Fix the type issues

## Before Creating PR
1. Ensure all tests pass
2. Update documentation if needed
3. Add/update tests for new functionality
4. Follow conventional commit format
5. Check that the build succeeds