---
created: 2025-08-16T16:23:53.319Z
updated: 2025-08-16T16:23:53.319Z
---

# lsmcp Configuration and Indexing

## Main Configuration (.lsmcp/config.json)
```json
{
  "files": ["**/*.ts", "**/*.tsx"],
  "symbolFilter": {
    "excludeKinds": ["Variable", "Constant", "String", "Number", "Boolean"]
  }
}
```

This configuration:
- Indexes TypeScript and TSX files
- Excludes certain symbol kinds from the project overview to reduce noise
- Note: TypeScript LSP reports module-level const/let as Properties, not Variables

## Available Presets
- `tsgo` - TypeScript with tsgo (recommended for TypeScript projects)
- `typescript` - Standard typescript-language-server
- `rust-analyzer` - Rust language support
- `moonbit` - MoonBit language
- `fsharp` - F# with fsautocomplete
- `deno` - Deno TypeScript/JavaScript
- `gopls` - Go official language server
- `hls` - Haskell Language Server
- `ocaml` - OCaml Language Server

## Symbol Indexing System
The indexing system provides fast symbol search across the codebase:

### Tools that use pre-built index (fast):
- `search_symbols` - Primary symbol search tool
- `search_symbol_from_index` - Direct index search
- `get_index_stats_from_index` - Index statistics
- `update_index_from_index` - Incremental index updates

### Index Management:
- Auto-indexing enabled by default (`autoIndex: true`)
- Concurrent indexing with 10 workers (`indexConcurrency: 10`)
- Index automatically updates with git changes
- Use `noCache: true` to force full re-index
- SQLite cache for persistence across sessions

### Symbol Kinds (LSP specification):
1. File
2. Module  
3. Namespace
4. Package
5. Class
6. Method
7. Property
8. Field
9. Constructor
10. Enum
11. Interface
12. Function
13. Variable (often reported as Property by TypeScript)
14. Constant (often reported as Property by TypeScript)
15. String
16. Number
17. Boolean
18. Array
19. Object
20. Key
21. Null
22. EnumMember
23. Struct
24. Event
25. Operator
26. TypeParameter

## Tool Naming Conventions
- Raw MCP tool names: snake_case (e.g., `get_hover`)
- Client-qualified names: `mcp__lsmcp__get_hover`
- Tools ending in `_from_index` use the pre-built index for speed

## Performance Tips
1. Use `search_symbols` for fast searching (uses index)
2. Use `get_symbol_details` for comprehensive symbol info
3. The index is automatically maintained - no manual updates needed
4. For large codebases, initial indexing may take time but subsequent searches are fast