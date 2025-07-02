# Pre-release Checklist

This document outlines the verification steps to be performed before releasing lsmcp.
The primary focus is to ensure that lsmcp-dev MCP functionality works correctly.

## Prerequisites

- Node.js is installed
- Project dependencies are installed (`pnpm install`)
- Build is completed (`pnpm build`)
- `.mcp.json` has lsmcp-dev configured

## 1. Basic Functionality Verification

### 1.1 MCP Server Startup

```bash
# Verify that the MCP server starts correctly in Claude Code
# Uses the lsmcp-dev configuration from .mcp.json
```

### 1.2 Tool List Retrieval

```
# List all available MCP tools from lsmcp-dev server
# Verify that 13 LSP tools are available
```

Expected: 13 LSP tools should be listed

## 2. LSP Core Features

### 2.1 Hover Information

```
# Use mcp__lsmcp-dev__get_hover
# Example: Get hover info for an import statement in src/mcp/lsmcp.ts
root: /home/mizchi/mizchi/lsmcp
filePath: src/mcp/lsmcp.ts
line: 14
target: debug
```

Expected: Type information and documentation for the imported function

### 2.2 Go to Definition

```
# Use mcp__lsmcp-dev__get_definitions
# Example: Find definition location for functions or classes
root: /home/mizchi/mizchi/lsmcp
filePath: src/mcp/lsmcp.ts
line: <line number>
symbolName: <symbol name>
```

Expected: File path and line number of the definition

### 2.3 Find References

```
# Use mcp__lsmcp-dev__find_references
# Example: Search where a specific function is used
root: /home/mizchi/mizchi/lsmcp
filePath: src/mcp/_mcplib.ts
line: <line number>
symbolName: debug
```

Expected: List of all locations where the symbol is used

### 2.4 Get Diagnostics

```
# Use mcp__lsmcp-dev__get_diagnostics
# Get TypeScript errors and warnings
root: /home/mizchi/mizchi/lsmcp
filePath: <target file>
```

Expected: Detailed error and warning information if any exist

### 2.5 Get All Diagnostics

```
# Use mcp__lsmcp-dev__get_all_diagnostics
# Get errors and warnings for all files in the project
root: /home/mizchi/mizchi/lsmcp
include: **/*.ts
severityFilter: all
```

Expected: Summary of all errors and warnings across the project

You can also test with filters:

```
# Filter by severity (error/warning/all)
root: /home/mizchi/mizchi/lsmcp
severityFilter: error

# Filter by file pattern
root: /home/mizchi/mizchi/lsmcp
include: src/**/*.ts
```

Expected: Filtered results based on severity or file pattern

### 2.6 Document Symbols

```
# Use mcp__lsmcp-dev__get_document_symbols
# Get structure of functions, classes, variables in a file
root: /home/mizchi/mizchi/lsmcp
filePath: src/mcp/lsmcp.ts
```

Expected: Hierarchical display of symbols within the file

## 3. Refactoring Features

### 3.1 Symbol Rename

```
# Use mcp__lsmcp-dev__rename_symbol
# Test by renaming a variable in a test file
root: /home/mizchi/mizchi/lsmcp
filePath: <test file>
line: <line number>
target: <old name>
newName: <new name>
```

Expected:
- Renamed consistently throughout the project
- Import/export statements are updated

### 3.2 Symbol Deletion

```
# Use mcp__lsmcp-dev__delete_symbol
# Delete unused variables or functions
root: /home/mizchi/mizchi/lsmcp
filePath: <test file>
line: <line number>
target: <symbol name>
removeReferences: true
```

Expected: Symbol and all its references are deleted

## 4. Code Completion and Help

### 4.1 Code Completion

```
# Use mcp__lsmcp-dev__get_completion
# Get completion suggestions from partial input
root: /home/mizchi/mizchi/lsmcp
filePath: <target file>
line: <line number>
target: <partial input>
```

Expected: Appropriate completion suggestions are displayed

### 4.2 Signature Help

```
# Use mcp__lsmcp-dev__get_signature_help
# Get parameter information for function calls
root: /home/mizchi/mizchi/lsmcp
filePath: <target file>
line: <line number>
target: <function call>
```

Expected: Function parameter information is displayed

## 5. Code Actions and Formatting

### 5.1 Get Code Actions

```
# Use mcp__lsmcp-dev__get_code_actions
# Get available code actions (quick fixes, refactorings) for a range
root: /home/mizchi/mizchi/lsmcp
filePath: <target file>
startLine: <line number>
```

Expected: List of available code actions (quick fixes, refactorings)

### 5.2 Format Document

```
# Use mcp__lsmcp-dev__format_document
# Format an entire document using the language server
root: /home/mizchi/mizchi/lsmcp
filePath: <target file>
applyChanges: false
```

Expected: Formatted code (preview without applying changes)

### 5.3 Workspace Symbols

```
# Use mcp__lsmcp-dev__get_workspace_symbols
# Search for symbols across the entire workspace
query: <search query>
root: /home/mizchi/mizchi/lsmcp
```

Expected: List of matching symbols across the project

## 6. Error Case Verification

### 6.1 Non-existent File

```
# Specify a non-existent file path
root: /home/mizchi/mizchi/lsmcp
filePath: non/existent/file.ts
```

Expected: Appropriate error message is displayed

### 6.2 Invalid Symbol Name

```
# Specify a non-existent symbol name
root: /home/mizchi/mizchi/lsmcp
filePath: src/mcp/lsmcp.ts
line: 10
target: NonExistentSymbol
```

Expected: Error message indicating symbol not found

### 6.3 File Outside Project

```
# Specify a file outside the project root
root: /home/mizchi/mizchi/lsmcp
filePath: /tmp/outside.ts
```

Expected: Appropriate error handling

## 7. Performance Testing

### 7.1 Large File Operations

- Symbol search in files with 1000+ lines
- Cross-file reference search

### 7.2 Concurrent Execution

- Execute multiple MCP tools in parallel
- Verify response times

## 8. LocationLink Format Verification

```bash
# Test typescript-language-server capabilities and LocationLink support
npx tsx scripts/verification/test-typescript-lsp.ts

# Compare location formats across different LSP servers
npx tsx scripts/verification/test-location-formats.ts
```

Expected: All scripts should complete successfully, showing proper handling of both Location and LocationLink formats.

## 9. Integration Testing

### 9.1 Real Development Workflow

1. Add a new function
2. Check for type errors with diagnostics
3. Fix errors
4. Refactor (rename)
5. Remove unused code

## Test Results Summary

### Working Features ✅
- [x] MCP server starts correctly
- [x] Tool list can be retrieved (13 tools available)
- [x] Hover information displays correctly
- [x] Go to definition works
- [x] Find references works (found 50 references)
- [x] Diagnostics can be retrieved
- [x] All diagnostics across project can be retrieved
- [x] Document symbols are displayed
- [x] Rename works correctly
- [x] Symbol deletion works
- [x] Code completion works
- [x] Signature help is displayed
- [x] Error cases are handled appropriately
- [x] Code actions work (quick fixes, refactoring)
- [x] Format document works
- [x] Example projects testing with check-examples.ts

### Known Issues ❌
- [ ] Workspace symbols search fails with "No Project" error (temporarily disabled)

### Fixed Issues ✅
- [x] Symbol deletion - **Now working with client-side fallback**
  - Implemented automatic fallback when LSP server doesn't support `workspace/applyEdit`
  - Successfully tested with `typescript-language-server`
- [x] Go to definition - **Now working with all LSP servers**
  - Added LocationLink format support for typescript-language-server and rust-analyzer
  - Maintains backward compatibility with Location format (tsgo, older servers)
  - Automatically converts LocationLink to Location format internally

## Notes

- Run each test case in the actual development environment
- Record error messages when errors occur
- Behavior may vary depending on TypeScript Language Server version
- **Recommendation**: Use `lsmcp-tsgo-dev` configuration for full functionality

## Recent Test Results

Last tested: 2025-01-02

### Summary
- ✅ 13/13 core features working with `typescript-language-server`
- ✅ 13/13 core features working with `tsgo`
- ✅ NEW: LocationLink format support added - fixes Go to definition for typescript-language-server
- ✅ NEW: Verified compatibility with rust-analyzer's LocationLink format
- ✅ NEW: Project-wide diagnostics with `get_all_diagnostics` tool
- ✅ NEW: Tool names simplified - removed `lsmcp_` prefix from all tools
- ✅ NEW: Multi-language support improved (F#, Rust, MoonBit)
- ✅ NEW: Example projects testing with `scripts/check-examples.ts`
- ✅ NEW: Verification scripts added in `scripts/verification/`