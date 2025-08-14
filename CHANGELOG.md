# [0.10.0-rc.2](https://github.com/mizchi/lsmcp/compare/v0.10.0-rc.1...v0.10.0-rc.2) (2025-08-14)


### Bug Fixes

* correct F# symbol positions when fsautocomplete returns comment lines ([cf88b87](https://github.com/mizchi/lsmcp/commit/cf88b87292367c3cfe6b3cd6d81c9104398aa7c8)), closes [#33](https://github.com/mizchi/lsmcp/issues/33)
* improve F# symbol position fix to handle record fields ([60a6a28](https://github.com/mizchi/lsmcp/commit/60a6a281b92683df98365fbedf1cbc7f62a3c9d6))


### Features

* generate lsmcp.schema.json from zod schema and implement environment auto-detection ([774e615](https://github.com/mizchi/lsmcp/commit/774e615fd63839011efbd051d2ef2b6fb91408d4))



## [0.10.0-rc.2] - 2025-08-13

### Added
- Memory monitoring and automatic garbage collection
- Performance optimization constants
- Ruby language support in test fixtures
- Comprehensive error handling with LSMCPError

### Changed
- Unified error handling system - replaced MCPToolError with LSMCPError
- Improved project detection with better error handling
- Enhanced TypeScript comment position handling
- Optimized symbol indexing with batch processing

### Fixed
- Lint warnings in test fixtures and source files
- Regex escape sequences in node_modules path matching
- Unused variable warnings with underscore prefix convention
- Memory leaks in symbol indexing

### Removed
- Deprecated mcpErrors.ts file
- Unused processedCount variable in indexing
- Moonbit database file from test fixtures

## [0.10.0-rc.1] - 2025-08-12

### Added
- Initial release candidate improvements
- Enhanced error handling system
- Better performance monitoring

## [0.10.0-rc.0](https://github.com/mizchi/lsmcp/compare/v0.9.4...v0.10.0-rc.0) (2025-01-10)

### 🚀 Features

* **Advanced Memory Report System**: Comprehensive project analysis and reporting system
  - Store project snapshots with mechanical metrics and AI analysis
  - SQLite-based storage in `.lsmcp/cache/memory.db`
  - Title and summary fields for better report identification
  - Duplicate prevention using unique commit hash constraints
  - Deprecated flag system for marking outdated reports
  - Reports are excluded from git repository (temporary investigation artifacts)

* **Report Management Tools**
  - `generate_report`: Create comprehensive project reports with optional AI analysis
  - `get_latest_report`: Retrieve the most recent report for current branch
  - `get_report_history`: View historical reports with pagination
  - `get_all_reports`: List all reports with filtering and sorting options
  - `get_report_details`: Get complete details of a specific report
  - `search_reports_by_keyword`: Full-text search across reports
  - `search_reports_by_date`: Find reports within date ranges
  - `get_report_by_commit`: Retrieve report for specific commit
  - `update_ai_analysis`: Add or update AI analysis for existing reports
  - `get_memory_stats`: View database statistics

* **Deprecated Report Management**
  - `deprecate_report`: Mark reports as deprecated with reason
  - `undeprecate_report`: Remove deprecated status from reports
  - `get_deprecated_reports`: List all deprecated reports
  - `withDeprecated` parameter: Control inclusion of deprecated reports in searches

### 📚 Documentation

* **Report System Documentation**: Comprehensive documentation in English and Japanese
  - Clear definition of reports as temporary investigation artifacts
  - Usage examples and best practices
  - Comparison with other documentation types

### ⚙️ Configuration

* **Advanced Memory Features**: Enable with `memoryAdvanced: true` in `.lsmcp/config.json`
  - Automatic `.gitignore` configuration for cache directory
  - SQLite database for persistent storage

## [0.9.4](https://github.com/mizchi/lsmcp/compare/v0.9.3...v0.9.4) (2025-01-10)

### Features

* External library indexing and symbol resolution for TypeScript
* Multi-language external library support preparation

## [0.9.3](https://github.com/mizchi/lsmcp/compare/v0.9.0...v0.9.3) (2025-08-07)


### Features

* add include_body option to get_definitions tool ([e7cc311](https://github.com/mizchi/lsmcp/commit/e7cc3112ef1f3b749089af3a14c22be277e888d0))
* add project overview tool and improve search_symbol_from_index ([9437b74](https://github.com/mizchi/lsmcp/commit/9437b74f9ec415d20213f855d97373675460f82f))
* improve search_symbol_from_index kind parameter to accept case-insensitive strings only ([63e0d26](https://github.com/mizchi/lsmcp/commit/63e0d268dfaab0cc66c8740a8d25a327d61f9943))


### BREAKING CHANGES

* Numeric values for kind parameter are no longer supported. Use string values instead (e.g., 'Class' instead of 5).

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>



## [0.9.2](https://github.com/mizchi/lsmcp/compare/v0.9.0...v0.9.2) (2025-08-07)


### Features

* add project overview tool and improve search_symbol_from_index ([9437b74](https://github.com/mizchi/lsmcp/commit/9437b74f9ec415d20213f855d97373675460f82f))
* improve search_symbol_from_index kind parameter to accept case-insensitive strings only ([63e0d26](https://github.com/mizchi/lsmcp/commit/63e0d268dfaab0cc66c8740a8d25a327d61f9943))


### BREAKING CHANGES

* Numeric values for kind parameter are no longer supported. Use string values instead (e.g., 'Class' instead of 5).

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>



# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0](https://github.com/mizchi/lsmcp/compare/v0.8.1...v0.9.0) (2025-08-07)

### 🚀 Features

* **Symbol Indexing**: Unified `index_symbols` tool with smart incremental updates
  - Automatic git-based change detection for efficient re-indexing
  - Support for parallel indexing with configurable concurrency
  - SQLite-backed cache for persistence across sessions
  - Memory-efficient batch processing for large codebases

* **Go Support**: Add gopls adapter for Go language support
  - Official Go language server (gopls) integration
  - Full LSP tool support for Go development
  - Comprehensive initialization options for enhanced functionality
  - Doctor command to verify Go and gopls installation

* **JSON Schema Configuration**: Add comprehensive configuration schema
  - Full validation and auto-completion support in editors
  - Centralized configuration in `.lsmcp/config.json`
  - Support for preset, LSP settings, and symbol filtering options

### 🐛 Bug Fixes

* **Test Stability**: Fix timing-related test failures in symbol index tests
* **MCP Tools**: Remove internal tools from public MCP API
  - Removed cache management tools (internal use only)
  - Removed workflow tools (internal use only)
  - Cleaner public API surface

### ♻️ Code Refactoring

* **Directory Structure**: Reorganize codebase for better separation of concerns
  - Move adapters to dedicated directory
  - Centralize configuration loading
  - Improve module organization

### 📚 Documentation

* **CLAUDE.md**: Update with current tool names and best practices
* **README.md**: Reorganize tools documentation by category
  - Symbol Indexing & Search
  - LSP Tools
  - Code Editing Tools
  - Memory System
  - File System Tools

### ⚡ Performance

* **Build Size**: Reduce bundle size from 505KB to 494KB
* **Symbol Indexing**: Improve indexing performance with batch processing

## [0.8.1](https://github.com/mizchi/lsmcp/compare/v0.8.0...v0.8.1) (2025-07-03)

### ♻️ Code Refactoring

* **Presets**: Rename moonbit-language-server preset to moonbit for consistency
  - Simplified preset naming convention
  - Better alignment with other language presets

## [0.8.0](https://github.com/mizchi/lsmcp/compare/v0.7.0...v0.8.0) (2025-07-03)

### 🚀 Features

* **Python Support**: Add Pyright and Ruff adapters for comprehensive Python language support
  - Pyright adapter for type checking and language features
  - Ruff adapter for fast Python linting
  - Full LSP tool support for Python development

### 📚 Documentation

* **Preset Usage**: Update all documentation to use `-p`/`--preset` pattern instead of deprecated `--language`
* **Manual Setup**: Add comprehensive manual setup documentation
  - Minimal rust-analyzer configuration example
  - Configuration file usage with `--config` option
  - Custom LSP server setup instructions
* **Available Presets**: Document all 8 built-in language presets
  - TypeScript (typescript, tsgo)
  - Python (pyright, ruff)
  - Rust (rust-analyzer)
  - F# (fsharp)
  - Deno
  - MoonBit

### 🐛 Bug Fixes

* **Type Errors**: Fix MCP SDK type mismatches using type casting approach
  - Resolve TypeScript compilation errors in mcpHelpers.ts
  - Ensure compatibility with both typescript-language-server and tsgo

### ♻️ Code Refactoring

* **Build Configuration**: Exclude Python virtual environments (.venv) from formatting

### 🔧 Chores

* Switch code formatter from Deno to Biome
* Drop MoonBit target support

## [0.7.0](https://github.com/mizchi/lsmcp/compare/v0.6.0...v0.7.0) (2025-07-02)

### 🎉 Highlights

- **LocationLink Support for Modern LSP Servers**: Fixes "Go to Definition" for typescript-language-server and rust-analyzer
- **Simplified Tool Names**: Removed `lsmcp_` prefix for better developer experience
- **Enhanced Documentation**: Language-specific installation guides for TypeScript, Rust, F#, and Python

### 🚀 Features

* **LocationLink Support**: Add support for LocationLink format used by modern LSP servers ([8ce97e7](https://github.com/mizchi/lsmcp/commit/8ce97e75e3240c6103495117bfb22cda0258922b))
  - Fixes Go to Definition for typescript-language-server
  - Maintains backward compatibility with Location format
  - Supports rust-analyzer and other modern LSP servers

### 🐛 Bug Fixes

* **Diagnostics**: Update diagnostic message format for consistency ([05a3752](https://github.com/mizchi/lsmcp/commit/05a3752782f04f5c8ee7d203178cee98a3e8fc9f))
  - Show "0 errors and 0 warnings" format when no diagnostics found
* **Tests**: Add retry mechanism for flaky integration tests ([6d00064](https://github.com/mizchi/lsmcp/commit/6d00064))
  - Vitest configured to retry failed tests up to 2 times
  - Handles timing-sensitive LSP operations in CI
* **Build**: Remove build step from list-tools test to prevent race conditions ([aa9525c](https://github.com/mizchi/lsmcp/commit/aa9525cb08729cd22c1e657c9cef265bc32959c0))

### 📚 Documentation

* **README**: Add language-specific installation guides ([5d108cc](https://github.com/mizchi/lsmcp/commit/5d108cc))
  - Separate sections for TypeScript, Rust, F#, Python
  - Include both `claude mcp add` and `.mcp.json` configuration examples
  - Reference examples directory for each language
* **English Guidelines**: Update documentation to use English consistently ([d9b6fd8](https://github.com/mizchi/lsmcp/commit/d9b6fd8))

### ♻️ Code Refactoring

* **Tool Names**: Remove `lsmcp_` prefix from all tool names ([f529203](https://github.com/mizchi/lsmcp/commit/f529203d442d83c10aa9f0a897cf653be76a9d57))
  - Simplified naming convention for better usability
  - All tools now use shorter names (e.g., `get_hover` instead of `lsmcp_get_hover`)

### 💥 BREAKING CHANGES

* **Tool Names**: All MCP tool names have changed. Users need to update their tool references:
  - `lsmcp_get_hover` → `get_hover`
  - `lsmcp_find_references` → `find_references`
  - `lsmcp_get_definitions` → `get_definitions`
  - `lsmcp_rename_symbol` → `rename_symbol`
  - `lsmcp_delete_symbol` → `delete_symbol`
  - `lsmcp_get_diagnostics` → `get_diagnostics`
  - `lsmcp_get_all_diagnostics` → `get_all_diagnostics`
  - `lsmcp_get_document_symbols` → `get_document_symbols`
  - `lsmcp_get_workspace_symbols` → `get_workspace_symbols`
  - `lsmcp_get_completion` → `get_completion`
  - `lsmcp_get_signature_help` → `get_signature_help`
  - `lsmcp_get_code_actions` → `get_code_actions`
  - `lsmcp_format_document` → `format_document`

### 🔄 Upgrading from v0.6.x

1. Update to v0.7.0:
   ```bash
   npm update @mizchi/lsmcp
   ```

2. Update your tool references to use the new names (remove `lsmcp_` prefix)

3. If you're using typescript-language-server, "Go to Definition" should now work correctly without any additional configuration

## [0.6.0](https://github.com/mizchi/typescript-mcp/compare/v0.5.0...v0.6.0) (2025-01-30)

### Bug Fixes

* use direct node_modules path to avoid npx overhead in tests ([ffacc6c](https://github.com/mizchi/typescript-mcp/commit/ffacc6c71470a48b61cea7881488ce75650c1040))
* correct CI workflow step names and restore checks ([954575e](https://github.com/mizchi/typescript-mcp/commit/954575e6e8d8f125a8dedb5e8517182eb11b0dde))
* make integration tests more robust ([7a6e0de](https://github.com/mizchi/typescript-mcp/commit/7a6e0ded5d074d739aa829604289ec3fe79cb25d))
* repair integration tests and fix tool names ([10b21a5](https://github.com/mizchi/typescript-mcp/commit/10b21a5782aa02de067d34ef74e4dea7a2350f1f))
* update integration test paths and fix test expectations ([605b360](https://github.com/mizchi/typescript-mcp/commit/605b360505015e6457403fd79505fe9310b7eca4))

### Continuous Integration

* update workflow files for improved test execution ([246f5db](https://github.com/mizchi/typescript-mcp/commit/246f5db4fbac088c24cbec5c96cef8e387c26c8f))

### Tests

* improve test performance with proper categorization ([5d2c136](https://github.com/mizchi/typescript-mcp/commit/5d2c1368ad1e8c22e50b016f6e6e0f80b8c5b19d))
* categorize tests into unit/integration for faster CI ([f5e6596](https://github.com/mizchi/typescript-mcp/commit/f5e6596af8ba13c95af69737174b0b37fd5e95ef))
* temporarily skip failing integration tests ([0746300](https://github.com/mizchi/typescript-mcp/commit/0746300bb2c9ad616b056fde013f4cf088a37b81))

### Chores

* temporarily disable tests in pre-push hook ([c660e6c](https://github.com/mizchi/typescript-mcp/commit/c660e6c9bb9baf93e67a3c93c37dd890c3b0e17d))
* add git hooks for code quality ([2c02720](https://github.com/mizchi/typescript-mcp/commit/2c027206df9cea36e98b91eed01c47b54c16f3c5))
* format code with deno fmt ([8f8fbbc](https://github.com/mizchi/typescript-mcp/commit/8f8fbbcdafc45f825e686d72c52da96ed08cc16f))
* apply deno formatting to test fixture ([e6e92eb](https://github.com/mizchi/typescript-mcp/commit/e6e92eb936bb019c3e456ee90c1a88e0a04cfadd))

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
  - Works with any DAP-compatible debugger (Node.js, Python, etc.)
- **Debug Session Management**:
  - Persistent session tracking
  - Automatic cleanup of stale sessions
  - Session metadata and statistics
- **Integration Examples**:
  - Algorithm debugging (LCS, performance analysis)
  - Test suite debugging
  - Multi-file debugging scenarios

#### 🌐 Multi-Language Support (2025-01-26)
- **Unified `lsmcp` CLI**: Single entry point for all languages
  - Use `--language` flag for specific languages
  - Use `--bin` flag for custom LSP servers
  - Automatic language detection based on project files
- **Enhanced Language Support**:
  - F# support with FSAutoComplete integration
  - Python improvements with better diagnostics
  - Configurable language mappings with glob patterns
- **Language-Specific Initialization**:
  - Modular initialization system
  - Per-language configuration options
  - Custom language server parameters

#### 🔧 Tool Improvements (2025-01-25)
- **Migration to LSP**: Gradual migration from TypeScript-specific to LSP tools
  - `ts_rename_symbol` → `lsp_rename_symbol`
  - `ts_delete_symbol` → `lsp_delete_symbol`
  - `ts_find_references` → `lsp_find_references`
  - `ts_get_definitions` → `lsp_get_definitions`
  - `ts_get_diagnostics` → `lsp_get_diagnostics`
  - See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for details
- **TypeScript Tool Prefixes**: Added `ts_` prefix to avoid conflicts
- **New Tools**:
  - `lsp_get_workspace_symbols` - Search symbols across workspace
  - Event-driven diagnostics with automatic fallback

### Changed
- **Project Structure**:
  - Moved to modular architecture
  - Separated LSP and TypeScript-specific implementations
  - Improved test organization (unit vs integration)
- **Performance**:
  - Optimized LSP diagnostics with caching
  - Fixed stale file contents issue (#8)
  - Improved test performance with categorization
- **Error Handling**:
  - Enhanced error messages with context
  - Better recovery from LSP failures
  - Improved timeout handling

### Fixed
- LSP diagnostics stale file contents issue (#8)
- Multi-language support for non-TypeScript projects (#15)
- Test reliability in CI environments
- Import/export order variations in tests
- Git hooks preventing commits
- TypeScript tool name conflicts

### Developer Experience
- Added comprehensive test suite for all tools
- Improved documentation with examples
- Better error messages and debugging info
- Consistent tool naming conventions

## [0.4.0] - 2025-01-12

### Added
- Initial release of TypeScript MCP tools
- Core TypeScript refactoring tools
- LSP-based tools for multi-language support
- Basic MCP server implementation