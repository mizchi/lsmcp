---
created: 2025-08-05T01:46:48.912Z
updated: 2025-08-05T01:46:48.912Z
---

# Task Completion Checklist

When completing a task in this Moonbit project, ensure you:

## Before Committing Code

1. **Format Code**
   ```bash
   moon fmt
   ```

2. **Check for Errors**
   ```bash
   moon check
   ```

3. **Run Tests**
   ```bash
   moon test
   ```

4. **Build the Project**
   ```bash
   moon build
   ```

## Additional Checks
- Verify no compilation errors exist
- Ensure all tests pass
- Check that code follows Moonbit conventions
- Verify TypeScript utilities still work if modified

## Important Notes
- Always format code with `moon fmt` before committing
- Run `moon check` to catch type errors early
- Test both JavaScript and WebAssembly targets if applicable
- Keep the `.lsmcp/config.json` updated if adding new file patterns