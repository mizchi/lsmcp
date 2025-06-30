# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2025-01-30

### Fixed
- Fixed flaky test in `typescript-lsp.test.ts` by using direct node_modules path instead of npx to avoid overhead in CI environments
- Fixed CI workflow step names and restored proper checks
- Improved test performance with proper categorization (unit vs integration tests)
- Made integration tests more robust with better timeout handling

### Changed
- Updated CI workflows to separate unit and integration tests for better performance
- Improved test categorization with separate Vitest projects for unit and integration tests

## [0.5.0] - 2025-01-28

### Added

#### 🎯 Debug Adapter Protocol (DAP) MCP v2 - Enhanced Debugging Tools
- **Complete DAP MCP Implementation**: Production-ready debug adapter protocol support
  - Session state management with proper lifecycle tracking
  - Breakpoint management with hit counts and conditional breakpoints
  - Debug event logging to JSONL files for analysis
  - Value tracking and history across debug sessions
  - Performance metrics tracking
  - Automatic cleanup of stale sessions
- **Enhanced Features**:
  - Export debug logs in multiple formats (JSON, JSONL, text)
  - Breakpoint statistics and hit count tracking
  - Session info and management tools
  - Comprehensive error handling and recovery
- **Examples and Documentation**:
  - Algorithm debugging examples (LCS, performance analysis)
  - Detailed usage documentation in `docs/dap-mcp-usage.md`
  - Test coverage for all debugging scenarios

### Changed
- Consolidated debug tools into single `dap-mcp` server
- Removed redundant `dap-demo` and `simple-debug` implementations

### Fixed
- Type errors in TypeScript tool handlers
- Flaky tests in DAP algorithm debugging suite
- MCP server startup issues

## [Unreleased]

### Added

#### 🐛 Debug Adapter Protocol (DAP) Support (2025-01-28)
- **DAP MCP Server**: New MCP server for debugging capabilities
  - Launch and attach to debug sessions
  - Set breakpoints with conditions
  - Step through code (step over/into/out)
  - Inspect variables and evaluate expressions
  - Stack trace inspection
  - Multiple concurrent debug sessions
- **TypeScript Debugging**: Support for debugging TypeScript files
  - Uses ts-blank-space for source transformation
  - Preserves line numbers for accurate debugging
  - No source map complexity
- **Simple Debug MCP**: Lightweight debugging helper
  - Track value changes over time
  - Compare values before/after
  - Measure execution time
  - Clear history functionality
- **Language Support Roadmap**: 
  - Current: JavaScript, TypeScript
  - Planned: Python, Go, Java, C/C++, Rust, C#, Ruby, PHP

#### ⚡ Real-time File Watching for Symbol Index (2025-01-26)
- **File System Watching**: Symbol index now automatically updates when files change
  - Monitors directories containing source files
  - Incremental updates on file modifications
  - Proper cleanup on process exit
- **Buffering/Debouncing**: Handles simultaneous file changes gracefully
  - 100ms debounce delay to batch multiple changes
  - Processes all queued updates in a single operation
  - Prevents race conditions during bulk file operations
- **Removed 5-minute Cache**: Replaced heuristic caching with real-time updates
- **Performance**: File watching is disabled in test environments for stability

#### 🔄 Project Renamed to lsmcp (2025-01-26)
- **Project Rebranding**: typescript-mcp → lsmcp (Language Service MCP)
  - Added "LSP for headless AI Agents" tagline
  - Main export now points to `lsmcp` instead of `typescript-mcp`
  - Added migration guide from typescript-mcp to lsmcp
- **README Improvements**:
  - Reorganized installation section with MCP server configuration first
  - Integrated multi-language documentation into main README
  - Added comprehensive migration guide

#### 🧪 Comprehensive Test Suite for Multi-Language Support (2025-01-26)
- **New MCP Client-based Tests**: 
  - Language detection tests for TypeScript, Rust, Moonbit, Python, Go, Java
  - Rust MCP server integration tests with rust-analyzer
  - Moonbit MCP server integration tests
  - TypeScript Language Server integration tests
  - TSGO (TypeScript Native Preview) support tests
  - Python MCP server tests
- **New `--include` Option for `lsmcp`**:
  - Batch diagnostics for files matching glob patterns
  - Example: `lsmcp --include "src/**/*.ts"` to check all TypeScript files
  - Currently supports TypeScript/JavaScript only
- **Test Fixes**:
  - Fixed TypeScript LSP completion test target
  - Fixed MCP SDK result format compatibility
  - Made cross-file rename tests more flexible
  - Fixed JSDoc documentation parsing
  - Added TSGO-specific error handling

#### 🎯 Unified LSP-MCP CLI Entry Point (2025-01-26)
- **New `lsmcp` Command**: Single entry point for all LSP-based language servers
  - Replaces the old single-language `lsp-mcp` (now `generic-lsp-mcp`)
  - Auto-detects project language based on config files
  - Supports `--language` flag for explicit language selection
  - Example: `lsmcp -l rust` or `lsmcp --language typescript`
- **Centralized Initialization**: Common initialization logic for all language servers
  - Shared tool registration with language-specific prefixes
  - Consistent error handling and LSP setup
  - Reduced code duplication across language servers
- **Simplified Language Server Files**: 
  - `moonbit-mcp.ts` and `rust-mcp.ts` now use shared initialization
  - Each language server reduced to ~25 lines of code
- **Help and Discovery**:
  - `lsmcp --help` shows all options and supported languages
  - `lsmcp --list` displays all supported languages
  - `lsmcp --init claude` works with auto-detection or explicit language
- **Renamed Commands**:
  - Old `lsp-mcp` → `generic-lsp-mcp` (for manual LSP_COMMAND configuration)
  - New `lsmcp` → Unified multi-language CLI

#### 🌍 Multi-Language Support (2025-01-25)
- **New Language-Specific MCP Servers**:
  - `moonbit-mcp` - Dedicated Moonbit language support
  - `rust-mcp` - Dedicated Rust language support via rust-analyzer
  - `multi-language-mcp` - Automatic language detection and LSP selection
- **Language Detection System**:
  - Automatic project type detection based on config files
  - Support for TypeScript, JavaScript, Moonbit, Rust, Python, Go, Java, C/C++
  - Manual language override with `FORCE_LANGUAGE` environment variable
- **Language-Specific Tool Prefixes**:
  - Moonbit tools: `moonbit_get_hover`, `moonbit_rename_symbol`, etc.
  - Rust tools: `rust_get_hover`, `rust_find_references`, etc.
  - Prevents tool name conflicts between different language servers
- **Infrastructure**:
  - New `languageDetection.ts` module for language configuration
  - Refactored LSP client to support multiple language IDs
  - Updated build configuration to generate 5 separate MCP executables

#### 📚 Documentation
- **README-multi-language.md**: Comprehensive guide for multi-language support
- **Migration guide**: From typescript-mcp to lsmcp
- **examples/moonbit-example.md**: Moonbit usage examples and setup (removed)
- **examples/rust-example.md**: Rust usage examples and setup (removed)

### Changed
- **Package Manager**: Switched from npm to pnpm in package.json
- **Build Improvements**: 
  - Fixed path resolution issues in unified-mcp.ts for dist directory
  - Simplified tsdown.config.ts to only build lsmcp and typescript-mcp
  - Main export in package.json now points to lsmcp
- **Linting**: 
  - Migrated from ESLint to oxlint
  - Removed all ESLint dependencies and configurations
  - Added .oxlintignore and updated oxlintrc.json
- **Code Organization**:
  - Merged playground directory into examples
  - Organized examples by language/project type
  - Removed obsolete markdown example files
- **Configuration**:
  - Updated .mcp.json with correct build paths
  - Added lsmcp as the primary MCP server
  - Removed non-existent lsp-mcp reference
- **Refactored Architecture**:
  - New `languageServerInit.ts` module for shared initialization logic
  - Centralized language configurations in `LANGUAGE_SERVER_CONFIGS`
  - Tool descriptions are now generated dynamically based on language
  - Extracted common code to reduce duplication:
    - `src/ts/utils/moduleResolution.ts` - Module path resolution
    - `src/ts/utils/symbolNavigation.ts` - Symbol finding helpers
    - `src/ts/utils/toolHandlers.ts` - Tool preparation logic
    - `src/mcp/languageServerInit.ts` - Language server initialization
- **Build System**:
  - Updated `tsdown.config.ts` to build multiple MCP servers
  - Added new bin entries in `package.json` for each language server
  - Updated deadcode scripts to include new MCP servers

### Removed
- ESLint configuration files (.eslintignore, eslint.config.ts)
- ESLint dependencies (@typescript-eslint/utils, eslint, typescript-eslint)
- sgconfig.yml (ast-grep configuration)
- Unused MCP server builds (generic-lsp-mcp, moonbit-mcp, rust-mcp, multi-language-mcp)
- playground directory (merged into examples)
- Obsolete example markdown files

### Technical Details
- Each language server inherits from the generic LSP-based MCP implementation
- Language servers automatically find and configure their respective LSP servers
- Consistent interface across all languages using LSP protocol
- Moonbit LSP server location: `~/.moon/bin/lsp-server.js`
- Rust LSP via rust-analyzer (requires `rustup component add rust-analyzer`)

## [0.0.14] - 2025-01-24

### Added

#### 🔄 Automatic TypeScript Fallback for LSP Rename (2025-01-24)
- **New**: Automatic fallback mechanism for rename operations
  - Detects when LSP server doesn't support rename (e.g., TypeScript Native Preview)
  - Seamlessly switches to TypeScript Compiler API
  - Maintains consistent interface across all LSP servers
- **LSP Client Enhancements**:
  - Added `prepareRename()` method for rename validation
  - Added `rename()` method with built-in error handling
  - Smart detection of unsupported methods (error code -32601)
- **Benefits**:
  - Works with all LSP servers, even those without rename support
  - Future-proof: automatically uses LSP rename when available
  - Transparent to users - same tool, automatic backend selection

#### 🚀 MCP Server Usability Improvements (2025-01-24)
- **New `list_tools` Command**:
  - Discover all available tools with descriptions
  - Filter by category: `typescript`, `lsp`, or `all`
  - Shows which tools require LSP server
- **Enhanced Error Handling**:
  - New `MCPToolError` class with actionable suggestions
  - Common error scenarios pre-defined
  - Alternative tool recommendations
  - Clear guidance for fixing issues
- **Interface Improvements**:
  - Consistent `line + target` pattern across tools
  - Removed confusing `character` parameter
  - More intuitive parameter names
- **Documentation**:
  - Comprehensive usage guide (`docs/mcp-usage-guide.md`)
  - Improvement proposals (`docs/mcp-improvements.md`)
  - Before/after comparisons showing 80-99% improvement in UX

#### 🌐 Comprehensive LSP Tools Suite (2025-01-24)
- **New LSP Tools**:
  - `lsp_get_completion` - Code completion suggestions
  - `lsp_get_document_symbols` - Document outline/symbols
  - `lsp_get_code_actions` - Quick fixes and refactorings
  - `lsp_get_signature_help` - Function parameter hints
  - `lsp_get_workspace_symbols` - Project-wide symbol search
  - `lsp_format_document` - Code formatting
  - `lsp_delete_symbol` - Delete symbol with references
- **Deno LSP Support**:
  - Added `initializationOptions` for Deno compatibility
  - Support for Deno-specific initialization parameters
  - Handle Deno namespace and permissions API
- **Infrastructure**:
  - Extracted common schemas to `src/common/`
  - Improved error handling across all tools
  - Comprehensive test coverage
  - Better project cache handling

### Changed
- **Breaking**: `lsp_get_completion` now uses `target` instead of `character`
- **Breaking**: `lsp_get_signature_help` now uses `target` instead of `character`

### Fixed
- Project cache now better handles non-TypeScript projects
- LSP tools provide clearer error messages when server is not running

## [0.0.13] - 2025-01-17

### Added
- LSP-based rename symbol tool (`lsp_rename_symbol`)
- Comprehensive test coverage for LSP rename operations
- Multi-file rename tests via MCP protocol

### Fixed
- Replace `findProjectForFile` with `getOrCreateProject` for better project handling
- Update import and export statements to remove file extensions
- Improve error handling in project cache

### Changed
- Improved project initialization for better performance
- Enhanced error messages for file not found scenarios

## [0.0.12] - 2025-01-10

### Added
- Initial release of TypeScript MCP Server
- TypeScript Compiler API tools:
  - `move_file` - Move files with import updates
  - `move_directory` - Move directories with import updates
  - `rename_symbol` - Rename symbols across codebase
  - `delete_symbol` - Delete symbols and references
  - `find_references` - Find all references to a symbol
  - `get_definitions` - Get symbol definitions
  - `get_diagnostics` - Get TypeScript diagnostics
  - `get_module_symbols` - List module exports
  - `get_type_in_module` - Get detailed type info
  - `get_type_at_symbol` - Get type at location
  - `get_symbols_in_scope` - Get available symbols
- Basic LSP integration:
  - `lsp_get_hover` - Hover information
  - `lsp_find_references` - Find references via LSP
  - `lsp_get_definitions` - Get definitions via LSP
  - `lsp_get_diagnostics` - Get diagnostics via LSP
- MCP server infrastructure
- Comprehensive test suite

[Unreleased]: https://github.com/mizchi/typescript-mcp/compare/v0.0.14...HEAD
[0.0.14]: https://github.com/mizchi/typescript-mcp/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/mizchi/typescript-mcp/compare/v0.0.12...v0.0.13
[0.0.12]: https://github.com/mizchi/typescript-mcp/releases/tag/v0.0.12