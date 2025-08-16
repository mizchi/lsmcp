---
created: 2025-08-16T16:23:31.971Z
updated: 2025-08-16T16:23:31.971Z
---

# Task Completion Checklist

When completing any coding task in the lsmcp project, ensure you:

## 1. Code Quality Checks
- [ ] Run `pnpm typecheck` to ensure no TypeScript errors
- [ ] Run `pnpm lint` to check for linting issues
- [ ] Run `pnpm format` to ensure consistent formatting

## 2. Testing
- [ ] Run `pnpm test:unit` for unit tests
- [ ] Run `pnpm build` before integration tests
- [ ] Run `pnpm test:integration` if changes affect MCP/LSP functionality
- [ ] Run specific language tests if modifying language adapters
  - For Rust: `pnpm test:languages:rust`
  - For TypeScript: `pnpm test:languages:tsgo`
  - For F#: `pnpm test:languages:fsharp`

## 3. Documentation
- [ ] Update relevant documentation if API changes
- [ ] Ensure all new functions have proper TypeScript types
- [ ] Add code comments in English for complex logic

## 4. Before Committing
- [ ] Verify all tests pass
- [ ] Check that build succeeds with `pnpm build`
- [ ] Review changes with `git diff`
- [ ] Use conventional commit format

## Important Reminders
- **NEVER** modify test timeouts without permission
- Always use `rg` (ripgrep) instead of `grep` for searching
- Build before running integration tests
- Use English for all documentation and comments
- Follow lowerCamelCase for file naming
- Add `.ts` extension to imports

## For Rust Example Project
When working in `examples/rust-project/`:
- [ ] Run `cargo check` to verify compilation
- [ ] Run `cargo fmt` to format Rust code
- [ ] Run `cargo clippy` for linting
- [ ] Run `cargo test` for Rust tests