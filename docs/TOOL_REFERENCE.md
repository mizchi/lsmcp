# Tool Reference

## Overview

lsmcp provides two types of tools:

1. **TypeScript-specific tools** - Available only for TypeScript/JavaScript projects
2. **LSP-common tools** - Available for all languages via Language Server Protocol

## TypeScript-specific Tools

These tools use the TypeScript Compiler API for precise code manipulation:

### lsmcp_move_file
Move a TypeScript/JavaScript file and update all import statements.

**Arguments:**
- `root`: Root directory
- `oldPath`: Current file path (relative)
- `newPath`: New file path (relative)
- `overwrite`: Overwrite destination if exists (optional)

**Example:**
```
Move src/utils/helper.ts to src/lib/helper.ts
```

### lsmcp_move_directory
Move an entire directory and update all imports.

**Arguments:**
- `root`: Root directory
- `sourcePath`: Directory to move (relative)
- `targetPath`: New directory path (relative)
- `overwrite`: Overwrite if exists (optional)

### lsmcp_delete_symbol
Delete a symbol and all its references.

**Arguments:**
- `root`: Root directory
- `filePath`: File containing the symbol
- `line`: Line number or string to match
- `symbolName`: Name of the symbol to delete
- `removeReferences`: Also delete references (default: true)

### lsmcp_get_module_symbols
List all exported symbols from a module.

**Arguments:**
- `root`: Root directory
- `moduleName`: Module to analyze (e.g., 'react', './utils')
- `filePath`: Context file for resolving relative imports (optional)

### lsmcp_get_type_in_module
Get detailed type information for a specific export from a module.

**Arguments:**
- `root`: Root directory
- `moduleName`: Module name
- `typeName`: Name of the type to analyze
- `filePath`: Context file (optional)

### lsmcp_get_type_at_symbol
Get detailed type information at a specific location.

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line number or string to match
- `symbolName`: Symbol name
- `symbolIndex`: Index if symbol appears multiple times (optional)

### lsmcp_get_symbols_in_scope
Get all symbols visible at a specific location.

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line number or string to match
- `meaning`: Filter by symbol type (optional)

### lsmcp_search_symbols
Search for symbols across the entire project using a pre-built index (fast).

The index is automatically maintained with file system watching, so changes to files are reflected immediately without needing to rebuild.

**Arguments:**
- `root`: Root directory
- `query`: Symbol name to search for (prefix match)
- `exact`: Whether to match exactly (optional, default: false)
- `includeNonExported`: Include non-exported symbols (optional, default: false)
- `kinds`: Filter by symbol kinds (optional, e.g., ["Function", "Class"])
- `limit`: Maximum number of results (optional, default: 50)
- `buildIndex`: Force rebuild of symbol index (optional, default: false)

**Example:**
```
Search for all classes starting with "User"
```

### lsmcp_find_import_candidates
Find potential import candidates for a symbol name using the symbol index (fast).

Uses the same automatically maintained index as `lsmcp_search_symbols`, with file system watching for immediate updates.

**Arguments:**
- `root`: Root directory
- `symbolName`: Symbol name to find import candidates for
- `currentFile`: Current file path to calculate relative imports (optional)
- `limit`: Maximum number of candidates (optional, default: 10)

**Example:**
```
Find import candidates for "Logger" from src/app.ts
```

### lsmcp_extract_type
Extract selected type expression into a type alias or interface (TypeScript only).

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `startLine`: Start line of the type expression
- `endLine`: End line of the type expression (optional)
- `extractType`: Extract as "type" or "interface"
- `typeName`: Name for the extracted type

**Example:**
```
Extract { name: string; age: number } to type alias "Person"
```

### lsmcp_generate_accessors
Generate get/set accessor methods for a class property (TypeScript only).

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line containing the property
- `propertyName`: Name of the property

**Example:**
```
Generate accessors for property "name" in class User
```

### lsmcp_call_hierarchy
View incoming/outgoing call hierarchy for functions (TypeScript only).

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line containing the function
- `symbolName`: Function name
- `direction`: "incoming" | "outgoing" | "both" (default: "both")
- `maxDepth`: Maximum depth to traverse (default: 3)

**Example:**
```
Show all functions that call handleRequest() and what it calls
```

## LSP-common Tools

These tools are available for all languages with LSP support:

### lsmcp_get_hover
Get documentation and type information for a symbol.

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line number
- `target`: Text to search for on the line

**Example:**
```
Show documentation for the "processData" function on line 42
```

### lsmcp_find_references
Find all references to a symbol across the codebase.

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line number
- `target` or `symbolName`: Symbol to find

### lsmcp_get_definitions
Go to the definition of a symbol.

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line number
- `target` or `symbolName`: Symbol to find

### lsmcp_rename_symbol
Rename a symbol across all files.

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line number
- `target` or `oldName`: Current name
- `newName`: New name

**Example:**
```
Rename the class "UserManager" to "UserService" in src/users.ts
```

### lsmcp_get_diagnostics
Get compilation errors and warnings.

**Arguments:**
- `root`: Root directory
- `filePath`: File path

### lsmcp_get_document_symbols
List all symbols in a file (classes, functions, variables, etc.).

**Arguments:**
- `root`: Root directory
- `filePath`: File path

### lsmcp_get_completion
Get code completion suggestions with optional auto-import support.

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line number
- `target`: Text before cursor (optional)
- `resolve`: Whether to resolve completion items for additional details (optional, default: false)
- `includeAutoImport`: Whether to include only auto-import suggestions (optional, default: false)

### lsmcp_get_signature_help
Get function signature information.

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line number
- `target`: Text at cursor position

### lsmcp_format_document
Format the entire document.

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `applyChanges`: Apply formatting (default: false)

### lsmcp_get_code_actions
Get available code actions (quick fixes, refactorings).

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `startLine`: Start line of range
- `endLine`: End line of range

### lsmcp_apply_code_action
Apply a specific code action.

**Arguments:**
- `root`: Root directory
- `filePath`: File path
- `line`: Line number
- `actionTitle`: Title of the action to apply

## Line Number Handling

All tools accept line numbers in two formats:

1. **Numeric**: Direct line number (1-based)
   ```
   line: 42
   ```

2. **String match**: Find the line containing this text
   ```
   line: "function processData"
   ```

When using string match, the tool will search for the first line containing the exact text.

## Error Handling

Tools will return error messages in these cases:

1. **File not found**: The specified file doesn't exist
2. **Symbol not found**: The symbol couldn't be located
3. **LSP not ready**: The language server is still initializing
4. **Unsupported operation**: The LSP server doesn't support this feature
5. **Language mismatch**: Using a TypeScript-specific tool with another language

## Best Practices

1. **Use specific tools for refactoring**: Always prefer `lsmcp_rename_symbol` over manual find-replace
2. **Check diagnostics first**: Run `lsmcp_get_diagnostics` before refactoring to ensure code is valid
3. **Use hover for exploration**: `lsmcp_get_hover` provides quick type information
4. **Batch operations**: When moving multiple files, consider moving the directory instead