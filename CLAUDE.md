You are a TypeScript/MCP expert developing the lsmcp tool - a unified Language Service MCP for multi-language support.

Given a URL, use read_url_content_as_markdown and summary contents.

## Language Guidelines

**Important**: In this repository, all documentation, comments, and code should be written in English. This includes:

- Code comments
- Documentation files (README, TODO, etc.)
- Commit messages
- Variable names and function names
- Error messages and logs

This ensures consistency and makes the project accessible to the global developer community.

## Project Goal

Provide unified Language Server Protocol (LSP) features as Model Context Protocol (MCP) tools for multiple programming languages.

## Development Stack

- pnpm: Package manager
- typescript: Core language
- tsdown: Rolldown-based bundler
- @modelcontextprotocol/sdk: MCP implementation
- vscode-languageserver-protocol: LSP client implementation

## Coding Rules

- file: lowerCamelCase
- add `.ts` extensions to import. eg. `import {} from "./x.ts"` for deno compatibility.

## Git Workflow

When working with this project:

1. **Commit message format**: Use conventional commits (feat:, fix:, docs:, etc.)
2. **Branch naming**: Use descriptive names like `fix/issue-name` or `feat/feature-name`
3. **Pull requests**: Target the main branch with clear descriptions

## Code Modification Workflow

When modifying code in this project:

### 1. Development Commands

```bash
# Build the project
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck     # Using tsgo (faster)

# Linting
pnpm lint          # Run with --quiet flag
```

### 2. Testing Strategy

- Unit tests are located alongside source files using Vitest's in-source testing
- Integration tests are in the `tests/` directory
- Run specific tests: `pnpm test -- path/to/test.ts`
- Run tests matching pattern: `pnpm test -- -t "pattern"`

### 3. Code Quality Checks

Before committing, always run:

1. `pnpm typecheck` - Ensure no TypeScript errors
2. `pnpm lint` - Check for linting issues
3. `pnpm test` - Verify all tests pass

### 4. Refactoring Guidelines

- Use `lsmcp-dev` MCP (project itself) tools for semantic refactoring
- Always include `.ts` extension in imports
- Follow existing patterns in the codebase

## Architecture Overview

## Implementation Notes

## Important Lessons Learned

**NEVER FORGET:**
- When tests fail, extending timeouts does NOT solve the problem
- You are NOT permitted to modify timeout settings without user permission

