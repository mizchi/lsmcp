---
created: 2025-08-05T01:34:41.968Z
updated: 2025-08-05T01:34:41.968Z
---

# Task Completion Checklist

When completing any coding task in this Rust project, ensure you:

## 1. Code Quality Checks
- [ ] Run `cargo check` to verify code compiles
- [ ] Run `cargo test` to ensure all tests pass
- [ ] Run `cargo fmt` to format code properly
- [ ] Run `cargo clippy` to check for common issues

## 2. Documentation
- [ ] Add/update doc comments (`///`) for public APIs
- [ ] Ensure function purposes are clear
- [ ] Update README.md if adding new features

## 3. Testing
- [ ] Write unit tests for new functionality
- [ ] Ensure test coverage for edge cases
- [ ] Run tests with `cargo test`
- [ ] Check test output with `cargo test -- --nocapture` if needed

## 4. Before Committing
- [ ] All tests pass: `cargo test`
- [ ] No clippy warnings: `cargo clippy`
- [ ] Code is formatted: `cargo fmt`
- [ ] Build succeeds: `cargo build`
- [ ] No unintended files in git status

## 5. LSP/LSMCP Verification
- [ ] Run `get_diagnostics` to check for any LSP-detected issues
- [ ] If modifying symbols, update symbol index with `index_files`
- [ ] Verify symbol navigation still works

## 6. Error Handling
- [ ] Check that error cases are handled appropriately
- [ ] Ensure error messages are helpful
- [ ] Test error conditions

## Quick Command Sequence
```bash
# Run this sequence before considering task complete:
cargo fmt
cargo check
cargo clippy
cargo test
```

If all commands succeed, the task can be considered complete.