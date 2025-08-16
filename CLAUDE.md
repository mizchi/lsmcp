## CRITICAL: PRIORITIZE LSMCP TOOLS FOR CODE ANALYSIS

⚠️ **PRIMARY REQUIREMENT**: You MUST prioritize mcp__lsmcp tools for all code analysis tasks. Standard tools should only be used as a last resort when LSMCP tools cannot accomplish the task.

### 📋 RECOMMENDED WORKFLOW

```
1. get_project_overview → Understand the codebase structure
2. search_symbols → Find specific symbols you need
3. get_symbol_details → Get comprehensive information about those symbols
```

### 🎯 WHEN TO USE EACH TOOL

**For Initial Exploration:**
- `mcp__lsmcp__get_project_overview` - First tool to run when exploring a new codebase
- `mcp__lsmcp__list_dir` - Browse directory structure when you need to understand file organization
- `mcp__lsmcp__get_symbols_overview` - Get a high-level view of symbols in specific files

**For Finding Code:**
- `mcp__lsmcp__search_symbols` - Primary search tool for functions, classes, interfaces, etc.
- `mcp__lsmcp__lsp_get_workspace_symbols` - Alternative workspace-wide symbol search
- `mcp__lsmcp__lsp_get_document_symbols` - List all symbols in a specific file

**For Understanding Code:**
- `mcp__lsmcp__get_symbol_details` - Get complete information (type, definition, references) in one call
- `mcp__lsmcp__lsp_get_hover` - Quick type information at a specific position
- `mcp__lsmcp__lsp_get_definitions` - Navigate to symbol definition (use `includeBody: true` for full implementation)
- `mcp__lsmcp__lsp_find_references` - Find all places where a symbol is used

**For Code Quality:**
- `mcp__lsmcp__lsp_get_diagnostics` - Check for errors in a specific file
- `mcp__lsmcp__lsp_get_code_actions` - Get available fixes and refactorings

**For Code Modification:**
- `mcp__lsmcp__lsp_rename_symbol` - Safely rename symbols across the codebase
- `mcp__lsmcp__lsp_format_document` - Format code according to language conventions
- `mcp__lsmcp__replace_range` - Make precise text replacements
- `mcp__lsmcp__replace_regex` - Pattern-based replacements
- `mcp__lsmcp__lsp_delete_symbol` - Remove symbols and their references

**For Developer Assistance:**
- `mcp__lsmcp__lsp_get_completion` - Get code completion suggestions
- `mcp__lsmcp__lsp_get_signature_help` - Get function parameter hints
- `mcp__lsmcp__lsp_check_capabilities` - Check what LSP features are available

### 📊 DETAILED WORKFLOW EXAMPLES

**1. EXPLORING A NEW CODEBASE**
```
1. mcp__lsmcp__get_project_overview
   → Understand structure, main components, statistics
2. mcp__lsmcp__search_symbols --kind "class"
   → Find all classes in the project
3. mcp__lsmcp__get_symbol_details --symbol "MainClass"
   → Deep dive into specific class implementation
```

**2. INVESTIGATING A BUG**
```
1. mcp__lsmcp__search_symbols --name "problematicFunction"
   → Locate the function
2. mcp__lsmcp__get_symbol_details --symbol "problematicFunction"
   → Understand its type, implementation, and usage
3. mcp__lsmcp__lsp_find_references --symbolName "problematicFunction"
   → See all places it's called
4. mcp__lsmcp__lsp_get_diagnostics --relativePath "path/to/file.ts"
   → Check for errors
```

**3. REFACTORING CODE**
```
1. mcp__lsmcp__search_symbols --name "oldMethodName"
   → Find the method to refactor
2. mcp__lsmcp__get_symbol_details --symbol "oldMethodName"
   → Understand current implementation and usage
3. mcp__lsmcp__lsp_rename_symbol --symbolName "oldMethodName" --newName "newMethodName"
   → Safely rename across codebase
4. mcp__lsmcp__lsp_format_document --relativePath "path/to/file.ts"
   → Clean up formatting
```

**4. ADDING NEW FEATURES**
```
1. mcp__lsmcp__get_project_overview
   → Understand existing architecture
2. mcp__lsmcp__search_symbols --kind "interface"
   → Find relevant interfaces to implement
3. mcp__lsmcp__get_symbol_details --symbol "IUserService"
   → Understand interface requirements
4. mcp__lsmcp__lsp_get_completion --line 50
   → Get suggestions while writing new code
```

**FALLBACK TOOLS (USE ONLY WHEN NECESSARY):**

- ⚠️ `Read` - Only when you need to see non-code files or LSMCP tools fail
- ⚠️ `Grep` - For text pattern searches in files (replaces removed search_for_pattern tool)
- ⚠️ `Glob` - Only when LSMCP file finding doesn't work
- ⚠️ `LS` - Only for basic directory listing when LSMCP fails
- ⚠️ `Bash` commands - Only for non-code operations or troubleshooting

### WHEN TO USE FALLBACK TOOLS

Use standard tools ONLY in these situations:

1. **Non-code files**: README, documentation, configuration files
2. **LSMCP tool failures**: When LSMCP tools return errors or no results
3. **Debugging**: When troubleshooting why LSMCP tools aren't working
4. **Special file formats**: Files that LSMCP doesn't support
5. **Quick verification**: Double-checking LSMCP results when needed

## Memory System

You have access to project memories stored in `.lsmcp/memories/`. Use these tools:

- `mcp__lsmcp__list_memories` - List available memory files
- `mcp__lsmcp__read_memory` - Read specific memory content
- `mcp__lsmcp__write_memory` - Create or update memories
- `mcp__lsmcp__delete_memory` - Delete a memory file

Memories contain important project context, conventions, and guidelines that help maintain consistency.

The context and modes of operation are described below. From them you can infer how to interact with your user
and which tasks and kinds of interactions are expected of you.

---

You are a TypeScript/MCP expert developing the lsmcp tool (v0.10.0-rc.3) - a unified Language Service MCP for multi-language support.

Given a URL, use read_url_content_as_markdown and summary contents.

## Language Guidelines

**Important**: In this repository, all documentation, comments, and code should be written in English. This includes:

- Code comments
- Documentation files (README, TODO, etc.)
- Commit messages
- Variable names and function names
- Error messages and logs

This ensures consistency and makes the project accessible to the global developer community.

## Development Stack

- pnpm: Package manager
- typescript: Core language
- tsdown: Rolldown-based bundler
- @modelcontextprotocol/sdk: MCP implementation
- vscode-languageserver-protocol: LSP client implementation

## Coding Rules

- file naming: lowerCamelCase (e.g., `symbolIndex.ts`, `lspClient.ts`)
- add `.ts` extensions to import. eg. `import {} from "./x.ts"` for deno compatibility.
- use TypeScript strict mode
- prefer interface over type for object definitions
- use async/await over promises

## Git Workflow

When working with this project:

1. **Commit message format**: Use conventional commits (feat:, fix:, docs:, etc.)
2. **Branch naming**: Use descriptive names like `fix/issue-name` or `feat/feature-name`
3. **Pull requests**: Target the main branch with clear descriptions

## Important Lessons Learned

**NEVER FORGET:**

- When tests fail, extending timeouts does NOT solve the problem
- You are NOT permitted to modify timeout settings without user permission
- Always run `pnpm build` before integration tests
- Use `rg` (ripgrep) instead of `grep` for searching code
- Run `pnpm test` to ensure all tests pass before committing
- Use `pnpm lint` and `pnpm typecheck` to check code quality
- TypeScript LSP doesn't return Variable/Constant symbol kinds for module-level declarations (they appear as Properties)
- When Variables/Constants show 0 in project overview, check if they're filtered by config
- Use `includeBody: true` in get_definitions to get full code implementation
- The index is automatically updated with git changes - use `noCache: true` to force full re-index

## Testing Strategy

- Unit tests: Fast, isolated tests for individual functions
- Integration tests: Test MCP server functionality with real LSP servers
- Adapter tests: Test language-specific LSP adapter configurations
- Always add tests for new features or bug fixes

## Common Commands

- `pnpm build` - Build the project
- `pnpm test` - Run all tests
- `pnpm lint` - Run linter
- `pnpm typecheck` - Type check with tsgo
- `pnpm format` - Format code with Biome
