# Symbol Search Guide

When searching for symbols in the indexed codebase:

## Basic Symbol Search

1. Use search_symbol for finding symbols by name:
   - Partial matching is supported
   - Filter by symbol kind (Class, Method, Function, etc.)
   - Limit search to specific files or directories

2. Symbol kinds (use these numbers for filtering):
   - 5: Class
   - 6: Method
   - 7: Property
   - 12: Function
   - 13: Variable
   - 11: Interface
   - 10: Enum

3. For better performance:
   - Use file path restrictions when possible
   - Be specific with symbol names
   - Use kind filters to narrow results

4. The index provides:
   - Fast symbol lookup without parsing files
   - Hierarchical symbol relationships
   - Location information for navigation

## Advanced Search Techniques

### 1. Combined Filters for Precise Results
```
search_symbol_from_index
- name: "User"
- kind: [5, 11]  # Classes and Interfaces only
- file: "models/**/*.ts"  # Only in models directory
- includeChildren: true
```

### 2. Hierarchical Symbol Navigation
```
get_document_symbols
- filePath: "src/components/UserProfile.tsx"
# Then drill down into specific symbols
```

### 3. Reference Analysis for Impact Assessment
```
find_references
- filePath: "src/types/User.ts"
- line: 15
- symbolName: "UserInterface"
```

### 4. Index Statistics for Performance Monitoring
```
get_index_stats_from_index
# Monitor: files indexed, symbols count, last update time
```

### 5. Pattern-based Symbol Discovery
Use partial matching for exploration:
- "create" → find all creation functions
- "Component" → find all React components
- "Service" → find all service classes

## Integration with Code Analysis

Symbol search works best when combined with:
1. **Diagnostics**: Find symbols mentioned in error messages
2. **Hover Info**: Get detailed type information for found symbols
3. **Definition Navigation**: Jump to symbol implementations
4. **Reference Tracking**: Understand symbol usage patterns

## Performance Best Practices

1. **Build index once**: Use index_files at project start
2. **Use specific filters**: Narrow searches with kind/file filters
3. **Leverage caching**: Index updates automatically on file changes
4. **Monitor stats**: Check get_index_stats for health monitoring

Happy symbol hunting! 🎯