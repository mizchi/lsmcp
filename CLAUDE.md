## CRITICAL: PRIORITIZE LSMCP TOOLS FOR CODE ANALYSIS

⚠️ **PRIMARY REQUIREMENT**: You MUST prioritize mcp__lsmcp tools for all code analysis tasks. Standard tools should only be used as a last resort when LSMCP tools cannot accomplish the task.

**YOUR APPROACH SHOULD BE:**

1. ✅ Always try mcp__lsmcp tools FIRST
2. ✅ Use `mcp__lsmcp__search_symbol_from_index` as primary search method  
3. ⚠️ Only use Read/Grep/Glob/LS when LSMCP tools are insufficient

### 🚨 TOOL USAGE PRIORITY

**PRIMARY TOOLS (USE THESE FIRST):**

- ✅ `mcp__lsmcp__get_project_overview` - Quick project analysis and structure overview
- ✅ `mcp__lsmcp__search_symbol_from_index` - Primary tool for symbol searches (auto-creates index if needed)
- ✅ `mcp__lsmcp__get_definitions` - Navigate to symbol definitions. Use `includeBody: true` to get code.
- ✅ `mcp__lsmcp__find_references` - Find all references to a symbol
- ✅ `mcp__lsmcp__get_hover` - Get type information and documentation
- ✅ `mcp__lsmcp__get_diagnostics` - Check for errors and warnings
- ✅ `mcp__lsmcp__get_all_diagnostics` - Get diagnostics for all files matching a pattern
- ✅ `mcp__lsmcp__get_document_symbols` - Get all symbols in a file
- ✅ `mcp__lsmcp__get_workspace_symbols` - Search symbols across the workspace
- ✅ `mcp__lsmcp__list_dir` - Explore directory structure
- ✅ `mcp__lsmcp__find_file` - Locate specific files
- ✅ `mcp__lsmcp__search_for_pattern` - Search for text patterns
- ✅ `mcp__lsmcp__index_symbols` - Smart incremental indexing (auto-detects changes)
- ✅ `mcp__lsmcp__clear_index` - Clear and rebuild index (use `force: true` for complete reset)
- ✅ `mcp__lsmcp__rename_symbol` - Rename a symbol across the codebase
- ✅ `mcp__lsmcp__get_completion` - Get code completion suggestions
- ✅ `mcp__lsmcp__get_signature_help` - Get parameter hints for function calls
- ✅ `mcp__lsmcp__format_document` - Format entire document with language server
- ✅ `mcp__lsmcp__get_code_actions` - Get available quick fixes and refactorings
- ✅ `mcp__lsmcp__delete_symbol` - Delete a symbol and optionally all its references
- ✅ `mcp__lsmcp__check_capabilities` - Check what features the language server supports

**SYMBOL EDITING TOOLS:**

- ✅ `mcp__lsmcp__replace_symbol_body` - Replace entire body of a symbol
- ✅ `mcp__lsmcp__insert_before_symbol` - Insert content before a symbol
- ✅ `mcp__lsmcp__insert_after_symbol` - Insert content after a symbol
- ✅ `mcp__lsmcp__replace_regex` - Replace content using regular expressions

### WORKFLOW

1. **START WITH PROJECT OVERVIEW**

   ```
   mcp__lsmcp__get_project_overview
   ```

   Get a quick understanding of:

   - Project structure and type
   - Key components (interfaces, functions, classes)
   - Statistics and dependencies
   - Directory organization
   - Symbol kind filtering (shows when Variables/Constants are excluded)

2. **SEARCH FOR SPECIFIC SYMBOLS**

   ```
   mcp__lsmcp__search_symbol_from_index
   ```

   The tool automatically:

   - Creates index if it doesn't exist
   - Updates index with incremental changes (git-aware)
   - Performs your search
   - Supports filtering by kind, name, container, file

3. **CODE EXPLORATION**

   - Search symbols: `mcp__lsmcp__search_symbol_from_index`
   - List directories: `mcp__lsmcp__list_dir`
   - Find files: `mcp__lsmcp__find_file`
   - Get file symbols: `mcp__lsmcp__get_document_symbols`
   - Search workspace: `mcp__lsmcp__get_workspace_symbols`

4. **CODE ANALYSIS**
   - Find definitions: `mcp__lsmcp__get_definitions` (use `includeBody: true` for full code)
   - Find references: `mcp__lsmcp__find_references`
   - Get type info: `mcp__lsmcp__get_hover`
   - Check errors: `mcp__lsmcp__get_diagnostics`
   - Check all errors: `mcp__lsmcp__get_all_diagnostics` (with pattern like `**/*.ts`)

**FALLBACK TOOLS (USE ONLY WHEN NECESSARY):**

- ⚠️ `Read` - Only when you need to see non-code files or LSMCP tools fail
- ⚠️ `Grep` - Only for quick searches when LSMCP search is insufficient
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
