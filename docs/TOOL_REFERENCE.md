# Tool Reference

This document enumerates all MCP tools provided by lsmcp, grouped by module boundaries. It reflects the current implementation and test coverage.

Naming conventions

- Actual tool names are snake_case ToolDef.name values (for example, get_hover, search_symbol_from_index).
- Some MCP clients (for example, Claude) display tools as mcp**lsmcp**get_hover. That is the client’s server-qualified name. When referring to tool names in documentation or configuration, use the raw tool name without any prefix (for example, get_hover).
- Source references in this document link to the implementation files.
  - LSP tools: [`src/lsp/tools/`](src/lsp/tools)
  - Index and project tools: [`src/mcp/tools/indexTools.ts`](src/mcp/tools/indexTools.ts)
  - Serenity tools: [`src/mcp/tools/index.ts`](src/mcp/tools/index.ts)
  - External library and symbol resolver (TypeScript-specific): [`src/mcp/tools/externalLibraryTools.ts`](src/mcp/tools/externalLibraryTools.ts), [`src/mcp/tools/symbolResolverTools.ts`](src/mcp/tools/symbolResolverTools.ts)

Module boundaries (high-level)

- LSP-common (language-agnostic via LSP): hover/definitions/references/diagnostics/symbols/etc. Source: [`src/lsp/tools/`](src/lsp/tools)
- Index & Project: build/update symbol index, query stats, project overview. Source: [`src/mcp/tools/indexTools.ts`](src/mcp/tools/indexTools.ts)
- Serenity: code edits, filesystem, memory, symbol overview helpers. Source: [`src/mcp/tools/index.ts`](src/mcp/tools/index.ts)
- TypeScript-specific: external library index and symbol resolution. Source: [`src/mcp/tools/externalLibraryTools.ts`](src/mcp/tools/externalLibraryTools.ts), [`src/mcp/tools/symbolResolverTools.ts`](src/mcp/tools/symbolResolverTools.ts)

LSP-common tools
Source: [`src/lsp/tools/`](src/lsp/tools)

- get_hover
  - Get hover/type information at a position or for a target string.
  - Args: root, filePath, line (number or string), character?, target?
  - Source: [`src/lsp/tools/hover.ts`](src/lsp/tools/hover.ts)
- find_references
  - Find all references to a symbol.
  - Args: root, filePath, line (number or string), symbolName
  - Source: [`src/lsp/tools/references.ts`](src/lsp/tools/references.ts)
- get_definitions
  - Go to definition with preview; supports include_body.
  - Args: root, filePath, line (number or string), symbolName, before?, after?, include_body?
  - Source: [`src/lsp/tools/definitions.ts`](src/lsp/tools/definitions.ts)
- get_diagnostics
  - Get diagnostics for a file (push/pull/poll fallback).
  - Args: root, filePath, timeout?, forceRefresh?
  - Source: [`src/lsp/tools/diagnostics.ts`](src/lsp/tools/diagnostics.ts)
- get_all_diagnostics
  - Project-wide diagnostics (server dependent).
  - Source: [`src/lsp/tools/allDiagnostics.ts`](src/lsp/tools/allDiagnostics.ts)
- get_document_symbols
  - List all symbols in a document (DocumentSymbol or SymbolInformation).
  - Args: root, filePath
  - Source: [`src/lsp/tools/documentSymbols.ts`](src/lsp/tools/documentSymbols.ts)
- get_workspace_symbols
  - Workspace symbol search.
  - Source: [`src/lsp/tools/workspaceSymbols.ts`](src/lsp/tools/workspaceSymbols.ts)
- get_completion
  - Completion at a position (resolve/auto-imports).
  - Source: [`src/lsp/tools/completion.ts`](src/lsp/tools/completion.ts)
- get_signature_help
  - Signature help at a position.
  - Source: [`src/lsp/tools/signatureHelp.ts`](src/lsp/tools/signatureHelp.ts)
- format_document
  - Format the entire document.
  - Source: [`src/lsp/tools/formatting.ts`](src/lsp/tools/formatting.ts)
- get_code_actions
  - Quick fixes/refactors for a range.
  - Source: [`src/lsp/tools/codeActions.ts`](src/lsp/tools/codeActions.ts)
- rename_symbol
  - Rename symbol project-wide.
  - Source: [`src/lsp/tools/rename.ts`](src/lsp/tools/rename.ts)
- delete_symbol
  - Delete symbol via LSP capability.
  - Source: [`src/lsp/tools/deleteSymbol.ts`](src/lsp/tools/deleteSymbol.ts)
- check_capabilities
  - Report supported LSP capabilities.
  - Source: [`src/lsp/tools/checkCapabilities.ts`](src/lsp/tools/checkCapabilities.ts)

Index & project tools
Source: [`src/mcp/tools/indexTools.ts`](src/mcp/tools/indexTools.ts), unified index at [`src/mcp/tools/indexToolsUnified.ts`](src/mcp/tools/indexToolsUnified.ts), overview at [`src/mcp/tools/projectOverview.ts`](src/mcp/tools/projectOverview.ts)

- index_symbols
  - Smart indexing with automatic incremental updates. On first run, full index using .lsmcp/config.json indexFiles or adapter defaults. Subsequent runs auto-update changed files; supports noCache and forceReset.
  - Args: pattern?, root?, concurrency?, noCache?, forceReset?
  - Source: [`src/mcp/tools/indexToolsUnified.ts`](src/mcp/tools/indexToolsUnified.ts)
- search_symbol_from_index
  - Fast symbol search using pre-built index. Auto-creates index if missing and updates incrementally.
  - Args: name?, kind (string or string[]; case-insensitive), file?, containerName?, includeChildren?, includeExternal?, onlyExternal?, sourceLibrary?, root?
  - Source: [`src/mcp/tools/indexTools.ts`](src/mcp/tools/indexTools.ts)
- get_index_stats_from_index
  - Stats about the symbol index (files, symbols, timings).
  - Args: root?
  - Source: [`src/mcp/tools/indexTools.ts`](src/mcp/tools/indexTools.ts)
- clear_index
  - Clear index; force=true also clears caches.
  - Args: root?, force?
  - Source: [`src/mcp/tools/indexTools.ts`](src/mcp/tools/indexTools.ts)
- get_project_overview
  - Project overview: project info, structure, key components, statistics. Auto-creates index if missing.
  - Args: root?
  - Source: [`src/mcp/tools/projectOverview.ts`](src/mcp/tools/projectOverview.ts)

Serenity tools (code editing, filesystem, memory, symbol overview)
Source: aggregator [`src/mcp/tools/index.ts`](src/mcp/tools/index.ts)

- Code editing
  - replace_symbol_body
    - Replace entire body for a symbol identified by namePath in a file; preserves indentation; marks file for auto-indexing.
    - Args: root, namePath ("Class/method"), relativePath, body
    - Source: [`src/mcp/tools/symbolEditTools.ts`](src/mcp/tools/symbolEditTools.ts)
  - insert_before_symbol
    - Insert content before a symbol definition.
    - Args: root, namePath, relativePath, body
    - Source: [`src/mcp/tools/symbolEditTools.ts`](src/mcp/tools/symbolEditTools.ts)
  - insert_after_symbol
    - Insert content after a symbol definition.
    - Args: root, namePath, relativePath, body
    - Source: [`src/mcp/tools/symbolEditTools.ts`](src/mcp/tools/symbolEditTools.ts)
  - replace_regex
    - Regex-based replacement with dotall/multiline; optional multi-occurrence; marks file for auto-indexing.
    - Args: root, relativePath, regex, repl, allowMultipleOccurrences?
    - Source: [`src/mcp/tools/regexEditTools.ts`](src/mcp/tools/regexEditTools.ts)
- File system helpers
  - list_dir, find_file, search_for_pattern
  - Source: [`src/mcp/tools/fileSystemTools.ts`](src/mcp/tools/fileSystemTools.ts)
- Memory management
  - list_memories, read_memory, write_memory, delete_memory
  - Source: [`src/mcp/tools/memoryTools.ts`](src/mcp/tools/memoryTools.ts)
  - See also: [`docs/memory-report-system.md`](docs/memory-report-system.md)
- Symbol overview helpers
  - get_symbols_overview, query_symbols
  - Source: [`src/mcp/tools/symbolTools.ts`](src/mcp/tools/symbolTools.ts)

TypeScript-specific tools (config-gated)
These tools are exposed when TypeScript language features are enabled. For backward compatibility, the legacy serenityTools aggregate includes them; prefer explicit enabling via config.
Source: [`src/mcp/tools/externalLibraryTools.ts`](src/mcp/tools/externalLibraryTools.ts), [`src/mcp/tools/symbolResolverTools.ts`](src/mcp/tools/symbolResolverTools.ts)

- index_external_libraries
  - Index TypeScript declaration files in node_modules for fast external symbol search.
  - Args: root, maxFiles?, includePatterns?, excludePatterns?
- get_typescript_dependencies
  - List dependencies that provide TypeScript declarations.
  - Args: root
- search_external_library_symbols
  - Search in indexed external libraries; filter by library/kind.
  - Args: root, libraryName?, symbolName?, kind?
- resolve_symbol
  - Resolve external symbol by analyzing imports with LSP support.
  - Args: root, filePath, symbolName
- get_available_external_symbols
  - List available external symbols in a file (resolved imports).
  - Args: root, filePath
- parse_imports
  - Parse and summarize imports (with resolved paths).
  - Args: root, filePath

Line number handling

- Many tools accept line as either:
  - Numeric: 1-based line number
  - String: the first line containing the exact text is used
    Examples: see [`src/lsp/tools/hover.ts`](src/lsp/tools/hover.ts), [`src/lsp/tools/references.ts`](src/lsp/tools/references.ts), [`src/lsp/tools/definitions.ts`](src/lsp/tools/definitions.ts)

Error handling (typical)

- File not found
- Symbol not found on the specified line
- LSP not initialized / not ready
- Unsupported operation by the language server
- Language mismatch for TypeScript-specific tools

Best practices

- Prefer structured refactoring over raw regex where possible:
  - Use rename_symbol for renames; avoid global find/replace
- Index-first workflow for cross-file symbol operations:
  - Use index_symbols to build/update the index
  - Use search_symbol_from_index for fast cross-project symbol search
- Diagnostics-first workflow:
  - Run get_diagnostics (and optionally get_all_diagnostics) before large refactors
- Scope TypeScript-specific tools behind languageFeatures.typescript.enabled unless relying on legacy aggregate

Client display note (Claude)

- When using lsmcp from Claude, tool names appear as mcp**lsmcp**{tool_name} (for example, mcp**lsmcp**get_hover). These are the same tools listed here; the mcp**lsmcp** prefix is added by the client to denote the server.
