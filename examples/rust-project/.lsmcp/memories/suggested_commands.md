---
created: 2025-08-05T01:34:27.412Z
updated: 2025-08-05T01:34:27.412Z
---

# Suggested Development Commands

## Building and Checking
- `cargo build` - Compile the project
- `cargo check` - Check for compilation errors without building
- `cargo clean` - Remove build artifacts

## Testing
- `cargo test` - Run all tests
- `cargo test -- --nocapture` - Run tests with stdout visible
- `cargo test test_calculator` - Run specific test

## Code Quality
- `cargo fmt` - Format code using rustfmt
- `cargo fmt -- --check` - Check formatting without modifying
- `cargo clippy` - Run Rust linter for common mistakes
- `cargo clippy -- -D warnings` - Treat warnings as errors

## Running
- `cargo run` - Build and run the main binary
- `cargo run --release` - Run optimized build

## Documentation
- `cargo doc` - Generate documentation
- `cargo doc --open` - Generate and open docs in browser

## rust-analyzer (LSP)
- `rustup component add rust-analyzer` - Install rust-analyzer
- Ensure rust-analyzer is in PATH for lsmcp integration

## LSMCP-specific Commands
When using lsmcp with this project:
- Symbol indexing: Tools with `_from_index` suffix use pre-built indexes
- Use `index_files` with pattern `**/*.rs` to build symbol index
- Use `search_symbol_from_index` for fast symbol searches
- Use `get_diagnostics` to check for compilation errors

## Project Maintenance
- `cargo update` - Update dependencies to latest compatible versions
- `cargo tree` - Display dependency tree
- `cargo audit` - Check for security vulnerabilities

## Version Control
- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Run tests before committing: `cargo test && cargo clippy`
- Ensure code is formatted: `cargo fmt`