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
# Use mcp__lsmcp-dev__list_tools to retrieve the tool list
# Verify that both LSP tools and TypeScript-specific tools are displayed
```

Expected: 12+ LSP tools should be listed

## 2. LSP Core Features

### 2.1 Hover Information

```
# Use mcp__lsmcp-dev__lsmcp_get_hover
# Example: Get hover info for an import statement in src/mcp/lsmcp.ts
root: /home/mizchi/mizchi/lsmcp
filePath: src/mcp/lsmcp.ts
line: 14
target: debug
```

Expected: Type information and documentation for the imported function

### 2.2 Go to Definition

```
# Use mcp__lsmcp-dev__lsmcp_get_definitions
# Example: Find definition location for functions or classes
root: /home/mizchi/mizchi/lsmcp
filePath: src/mcp/lsmcp.ts
line: <line number>
symbolName: <symbol name>
```

Expected: File path and line number of the definition

### 2.3 Find References

```
# Use mcp__lsmcp-dev__lsmcp_find_references
# Example: Search where a specific function is used
root: /home/mizchi/mizchi/lsmcp
filePath: src/mcp/_mcplib.ts
line: <line number>
symbolName: debug
```

Expected: List of all locations where the symbol is used

### 2.4 Get Diagnostics

```
# Use mcp__lsmcp-dev__lsmcp_get_diagnostics
# Get TypeScript errors and warnings
root: /home/mizchi/mizchi/lsmcp
filePath: <target file>
```

Expected: Detailed error and warning information if any exist

### 2.5 Document Symbols

```
# Use mcp__lsmcp-dev__lsmcp_get_document_symbols
# Get structure of functions, classes, variables in a file
root: /home/mizchi/mizchi/lsmcp
filePath: src/mcp/lsmcp.ts
```

Expected: Hierarchical display of symbols within the file

## 3. Refactoring Features

### 3.1 Symbol Rename

```
# Use mcp__lsmcp-dev__lsmcp_rename_symbol
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
# Use mcp__lsmcp-dev__lsmcp_delete_symbol
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
# Use mcp__lsmcp-dev__lsmcp_get_completion
# Get completion suggestions from partial input
root: /home/mizchi/mizchi/lsmcp
filePath: <target file>
line: <line number>
target: <partial input>
```

Expected: Appropriate completion suggestions are displayed

### 4.2 Signature Help

```
# Use mcp__lsmcp-dev__lsmcp_get_signature_help
# Get parameter information for function calls
root: /home/mizchi/mizchi/lsmcp
filePath: <target file>
line: <line number>
target: <function call>
```

Expected: Function parameter information is displayed

## 5. TypeScript-Specific Features

### 5.1 Type Extraction

```
# Use mcp__lsmcp-dev__lsmcp_extract_type (if available)
# Extract complex type expressions as type aliases
```

### 5.2 Generate Accessors

```
# Use mcp__lsmcp-dev__lsmcp_generate_accessors (if available)
# Generate get/set methods for properties
```

### 5.3 Call Hierarchy

```
# Use mcp__lsmcp-dev__lsmcp_call_hierarchy (if available)
# Display function call hierarchy
```

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

## 8. Integration Testing

### 8.1 Real Development Workflow

1. Add a new function
2. Check for type errors with diagnostics
3. Fix errors
4. Refactor (rename)
5. Remove unused code

## Test Results Summary

### Working Features ✅
- [ ] MCP server starts correctly
- [ ] Tool list can be retrieved
- [ ] Hover information displays correctly
- [ ] Go to definition works
- [ ] Find references works
- [ ] Diagnostics can be retrieved
- [ ] Document symbols are displayed
- [ ] Rename works correctly
- [ ] Symbol deletion works
- [ ] Code completion works
- [ ] Signature help is displayed
- [ ] Error cases are handled appropriately
- [ ] Performance is within acceptable range

### Known Issues ❌
- [ ] Go to definition - **Does not work with `typescript-language-server`** (returns 0 definitions)
  - Works correctly with `tsgo` LSP server (`lsmcp-tsgo-dev`)
  - Other features (hover, find references) work fine with both servers
  - This appears to be a `typescript-language-server` specific issue

### Fixed Issues ✅
- [x] Symbol deletion - **Now working with client-side fallback**
  - Implemented automatic fallback when LSP server doesn't support `workspace/applyEdit`
  - Successfully tested with `typescript-language-server`

## Notes

- Run each test case in the actual development environment
- Record error messages when errors occur
- Behavior may vary depending on TypeScript Language Server version
- **Recommendation**: Use `lsmcp-tsgo-dev` configuration for full functionality

## Recent Test Results

Last tested: 2025-01-30

### Summary
- ✅ 10/11 core features working with `typescript-language-server` (symbol deletion now works!)
- ✅ 11/11 core features working with `tsgo`
- ❌ Definition jump only works with `tsgo`, not with `typescript-language-server`