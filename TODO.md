# LSMCP TODO List

## Completed ✅

### v0.7.0 Refactoring
- [x] **Refactoring Plan Development** - Comprehensive refactoring plan created
- [x] **Unified Error Handling** - LSMCPError system implemented
- [x] **Tool Pattern Abstraction** - Code duplication reduced with Factory pattern
- [x] **Type Safety Improvements** - All `any` types eliminated, type guards added
- [x] **LocationLink Format Support** - Added support for modern LSP servers (typescript-language-server, rust-analyzer)

## In Progress 🚧

### Performance Optimization
- [ ] **File Cache Implementation** (Priority: Medium)
  - File read caching mechanism
  - TTL-based automatic invalidation
  - Memory usage monitoring and limits

## Not Started 📋

### Architecture Improvements
- [ ] **Schema Unification** (Priority: Low)
  - Unified schema for common parameters (root, filePath, line, etc.)
  - Schema inheritance to reduce duplication
  - Common validation logic

- [ ] **Plugin System Design** (Priority: Low)
  - Language support as plugins
  - Dynamic registration of custom tools
  - Configuration-based extension mechanism

### Feature Additions
- [ ] **Multi-Project Support**
  - Support for multiple tsconfig.json files
  - Project switching within workspace
  - Inter-project dependency analysis

- [ ] **Extract Function Refactoring**
  - Extract selected range as function
  - Automatic parameter inference
  - Return type inference

- [ ] **Dead Code Detection**
  - Detect unused exports
  - Detect unreachable code
  - TSR-like functionality implementation

### Testing Improvements
- [ ] **Pyright Adapter Tests**
  - Fix pyright-langserver initialization timeout
  - Investigate LSP handshake issues
  - Add proper Python environment detection

- [ ] **Java MCP Tests**
  - Java Language Server test coverage
  - Eclipse JDT Language Server integration tests

- [ ] **E2E Test Expansion**
  - Real development workflow simulation
  - Performance benchmarks

### Documentation
- [ ] **Auto-generated API Documentation**
  - API reference using TypeDoc
  - Comprehensive usage examples

- [ ] **Language-specific Setup Guides**
  - LSP server installation instructions per language
  - Troubleshooting guides

### Developer Experience
- [ ] **Debug Mode Improvements**
  - Detailed trace logs
  - LSP communication dump functionality
  - Performance profiling

## Known Issues 🐛

- MoonBit diagnostics can be slow (timeout adjustment needed)
- Performance degradation with large files
- workspace/applyEdit not supported by some LSP servers

## Future Considerations 💭

- WebAssembly build
- VS Code extension integration
- Real-time collaboration features
- AI-assisted refactoring suggestions

---

Last updated: 2025-01-30