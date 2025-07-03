# LSMCP TODO List

## Completed ✅

### v0.7.0 Refactoring

- [x] **Refactoring Plan Development** - Comprehensive refactoring plan created
- [x] **Unified Error Handling** - LSMCPError system implemented
- [x] **Tool Pattern Abstraction** - Code duplication reduced with Factory pattern
- [x] **Type Safety Improvements** - All `any` types eliminated, type guards added
- [x] **LocationLink Format Support** - Added support for modern LSP servers (typescript-language-server, rust-analyzer)

## In Progress 🚧

### Bug Fixes

- [ ] **Workspace Symbols Search** (Priority: High)
  - Currently fails with "No Project" error in tsserver
  - Feature is temporarily disabled in lspGetWorkspaceSymbols.ts
  - Requires proper project initialization implementation
  - Consider alternative approaches (e.g., using tsconfig.json path)

### Performance Optimization

- [ ] **File Cache Implementation** (Priority: Medium)
  - File read caching mechanism
  - TTL-based automatic invalidation
  - Memory usage monitoring and limits

## Not Started 📋

### Architecture Improvements

- [x] **Schema Unification** (Priority: Low)

  - Unified schema for common parameters (root, filePath, line, etc.)
  - Schema inheritance to reduce duplication
  - Common validation logic

- [x] **Plugin System Design** (Priority: Low)
  - Language support as plugins
  - Dynamic registration of custom tools
  - Configuration-based extension mechanism
