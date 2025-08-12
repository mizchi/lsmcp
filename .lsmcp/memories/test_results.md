---
created: 2025-08-12T08:17:02.427Z
updated: 2025-08-12T08:17:02.427Z
---

# lsmcp-dev Tool Test Results

## Test Date: 2025-08-12

### Tested Functions

1. **Project Overview** ✅
   - Successfully retrieved project statistics, structure, and key components
   - Identified 286 files, 2493 symbols

2. **Symbol Index** ✅
   - Index creation: Automatic
   - Search by name: Working (found SymbolIndex, createLSPClient)
   - Search by kind: Working (Class, Function filters)
   - Index stats: 286 files, 2493 symbols, indexed in ~26s

3. **Definition Jump** ✅
   - Successfully found createLSPClient definition with full body
   - Location: packages/lsp-client/src/lspClient.ts:170

4. **Find References** ✅
   - Found 2 references to createLSPClient
   - Accurate location tracking

5. **Hover Information** ✅
   - Retrieved type signature for createLSPClient
   - Shows function signature with parameter types

6. **Diagnostics** ✅
   - File diagnostics: Working (no errors in clean files)
   - Project-wide diagnostics: Found 30 errors in 9 files
   - Severity filtering: Working (error filter applied)

7. **Document Symbols** ✅
   - Retrieved complete symbol hierarchy for SymbolIndex class
   - Shows all methods, properties, and nested symbols with ranges

8. **Code Completion** ✅
   - Basic completion working
   - Shows available properties/methods at cursor position

9. **Signature Help** ✅
   - Shows parameter hints for function calls
   - Displays parameter types and names

10. **Document Formatting** ✅
    - Detects formatting issues
    - Preview mode working (applyChanges: false)
    - Found 1 formatting change in test file

11. **Memory System** ✅
    - List memories: 6 memories found
    - Read memory: Successfully read project_overview
    - Write memory: This test confirms write functionality

## Summary
All major lsmcp-dev tool functions are working correctly. The tool provides comprehensive code analysis capabilities through LSP integration.