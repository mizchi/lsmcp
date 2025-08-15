/**
 * Markdown content for MCP prompts
 * This file contains the markdown content as TypeScript strings for better bundling support
 */

export const onboardingMarkdown = `# LSMCP Symbol Indexing Setup

You are setting up lsmcp's symbol indexing for a code project.
This will enable fast symbol search and navigation without repeatedly parsing files.

## Quick Start Guide

### 1. Explore Project Structure (30 seconds)
- Run: list_dir { "relativePath": ".", "recursive": false }
- Look for source directories like src/, lib/, app/, or similar
- Run: find_file { "fileMask": "*.ts", "relativePath": "." } (adjust extension based on project)

### 2. Index the Codebase (1-2 minutes)
Based on what you find, index files with appropriate patterns:
- TypeScript/JavaScript: index_files { "pattern": "**/*.{ts,tsx,js,jsx}" }
- Python: index_files { "pattern": "**/*.py" }
- Go: index_files { "pattern": "**/*.go" }
- Mixed: index_files { "pattern": "**/*.{ts,js,py,go}" }

Exclude test/vendor files if needed:
- index_files { "pattern": "src/**/*.ts" }

### 3. Verify Index Success
- Run: get_index_stats
- You should see total files and symbols indexed
- If 0 symbols, check if LSP server supports the file type

### 4. Test Symbol Search
Try these commands:
- search_symbol { "name": "main" }
- search_symbol { "kind": [5, 12] } (Classes and Functions)
- get_file_symbols { "filePath": "path/to/main/file" }

### 5. Save Configuration
Write to memory the successful configuration:
- write_memory { "memoryName": "symbol_index_info", "content": "..." }

Include: language, glob pattern used, total files/symbols, and any issues encountered.

Ready to start your LSMCP journey! 🚀`;

export const codeAnalysisMarkdown = `# Rapid Code Analysis Task

Execute the following analysis phases:

## Phase 1: Capability Check (5 seconds)
Verify available LSP features:
\`\`\`
check_capabilities
\`\`\`

## Phase 2: Project-wide Diagnostics (10 seconds)
Collect all errors and warnings:
\`\`\`
get_all_diagnostics
- pattern: "**/*.{ts,tsx,js,jsx}"
- severityFilter: "error"  # Start with errors only
- useGitignore: true
\`\`\`

If few errors found, repeat with severityFilter: "warning"

## Phase 3: Symbol Analysis (5 seconds per symbol)
For critical functions/classes:
\`\`\`
find_references
- filePath: "<RELATIVE_FILE_PATH>"
- line: <LINE_NUMBER>
- symbolName: "<SYMBOL_NAME>"
\`\`\`

## Phase 4: Type Verification (3 seconds per location)
For suspicious code locations:
\`\`\`
get_hover
- filePath: "<RELATIVE_FILE_PATH>"
- line: <LINE_NUMBER>
- target: "<CODE_SNIPPET>"
\`\`\`

## Phase 5: Unused Code Detection
Identify symbols with zero references:
\`\`\`
find_references
- Check exported functions/classes
- Flag items with 0 references
\`\`\`

## Report Format
1. **Executive Summary**
   - Total errors/warnings count
   - Critical issues requiring immediate attention
   
2. **Detailed Findings**
   - Group by severity (Error > Warning > Info)
   - Include file:line references
   - Show affected symbol names
   
3. **Impact Analysis**
   - Number of files affected
   - Cross-module dependencies
   
4. **Recommendations**
   - Priority fixes
   - Refactoring suggestions
   - Code quality improvements

## Performance Expectations
- **Phase 1**: Instant (<1s)
- **Phase 2**: 5-30s depending on project size
- **Phase 3**: 2-5s per symbol
- **Phase 4**: 1-3s per hover request
- **Phase 5**: 10-60s for full project scan

## Tips for Effective Analysis
1. Start with error-level diagnostics before checking warnings
2. Focus on high-traffic symbols (frequently imported/used)
3. Use specific file patterns to narrow scope when needed
4. Combine with traditional grep for text-pattern searches
5. Run analysis after significant refactoring to catch regressions

Ready to analyze your codebase! 🔍`;

export const symbolSearchMarkdown = `# Symbol Search Guide

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
\`\`\`
search_symbol_from_index
- name: "User"
- kind: [5, 11]  # Classes and Interfaces only
- file: "models/**/*.ts"  # Only in models directory
- includeChildren: true
\`\`\`

### 2. Hierarchical Symbol Navigation
\`\`\`
get_document_symbols
- filePath: "src/components/UserProfile.tsx"
# Then drill down into specific symbols
\`\`\`

### 3. Reference Analysis for Impact Assessment
\`\`\`
find_references
- filePath: "src/types/User.ts"
- line: 15
- symbolName: "UserInterface"
\`\`\`

### 4. Index Statistics for Performance Monitoring
\`\`\`
get_index_stats_from_index
# Monitor: files indexed, symbols count, last update time
\`\`\`

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

Happy symbol hunting! 🎯`;

export const compressionAnalysisMarkdown = `# Token Compression Analysis Guide

To analyze token compression effectiveness:

## Basic Compression Analysis

1. Use measure_compression to check compression ratios:
   - Provide file paths to analyze
   - The tool shows original vs compressed token counts
   - Typical compression ratios are 90-98%

2. Compression is most effective for:
   - Large source files with many symbols
   - Files with detailed implementations
   - Complex class hierarchies

3. The compressed format includes:
   - Symbol names and kinds
   - Hierarchical structure
   - Basic location information
   - No implementation details

4. Use cases for compression:
   - Providing context to AI models
   - Quick codebase overview
   - Navigation and search
   - Understanding code structure without details

## Practical Examples

### Example 1: Large React Component Analysis
\`\`\`
measure_compression
- filePaths: ["src/components/Dashboard.tsx"]
# Typical result: 95-98% compression for component files
\`\`\`

### Example 2: Complex TypeScript Module
\`\`\`
measure_compression  
- filePaths: ["src/services/ApiService.ts", "src/types/ApiTypes.ts"]
# Compressions effective for: interfaces, type definitions, class methods
\`\`\`

### Example 3: Batch Analysis for Optimization
\`\`\`
measure_compression
- filePaths: [
    "src/utils/helpers.ts",
    "src/config/constants.ts", 
    "src/models/User.ts"
  ]
# Identify which files benefit most from compression
\`\`\`

## Compression Effectiveness by File Type

| File Type | Typical Compression | Best Use Case |
|-----------|-------------------|---------------|
| Components (.tsx/.jsx) | 90-98% | UI overview, props analysis |
| Services (.ts) | 85-95% | API structure understanding |
| Types/Interfaces | 80-90% | Schema comprehension |
| Utils/Helpers | 70-85% | Function catalog |
| Config files | 60-80% | Settings overview |

## When to Use Compression

✅ **Good for:**
- Providing codebase overview to AI models
- Understanding project structure
- Symbol discovery and navigation
- Code reviews and documentation

❌ **Not ideal for:**
- Debugging specific implementation details
- Reading exact code logic
- Performance optimization analysis
- Security audit requirements

## Integration with LSMCP Workflow

1. **Start with compression** for quick codebase overview
2. **Use symbol search** to identify specific areas of interest
3. **Drill down with full file reads** for detailed analysis
4. **Combine with diagnostics** for error-focused compression

## Monitoring and Optimization

Track compression effectiveness:
- Monitor compression ratios over time
- Identify files that compress poorly (may need refactoring)
- Use compression data to guide code organization

Compression analysis helps you work smarter, not harder! 📊`;
