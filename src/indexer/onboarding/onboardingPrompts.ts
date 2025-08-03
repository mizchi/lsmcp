/**
 * Onboarding prompts for lsmcp symbol indexing
 */

export interface OnboardingParams {
  system: string;
  rootPath: string;
}

export const symbolIndexOnboardingPrompt = ({
  system,
  rootPath,
}: OnboardingParams) => `You are setting up lsmcp's symbol indexing for a code project.
This will enable fast symbol search and navigation without repeatedly parsing files.

Project: ${rootPath}
System: ${system}

## Quick Start Guide

### 1. Explore Project Structure (30 seconds)
- Run: list_dir { "relativePath": ".", "recursive": false }
- Look for source directories like src/, lib/, app/, or similar
- Run: find_file { "fileMask": "*.ts", "relativePath": "." } (adjust extension based on project)

### 2. Index the Codebase (1-2 minutes)
Based on what you find, index files with appropriate patterns:
- TypeScript/JavaScript: new_index_files { "pattern": "**/*.{ts,tsx,js,jsx}", "root": "${rootPath}" }
- Python: new_index_files { "pattern": "**/*.py", "root": "${rootPath}" }
- Go: new_index_files { "pattern": "**/*.go", "root": "${rootPath}" }
- Mixed: new_index_files { "pattern": "**/*.{ts,js,py,go}", "root": "${rootPath}" }

Exclude test/vendor files if needed:
- new_index_files { "pattern": "src/**/*.ts", "root": "${rootPath}" }

### 3. Verify Index Success
- Run: new_get_index_stats { "root": "${rootPath}" }
- You should see total files and symbols indexed
- If 0 symbols, check if LSP server supports the file type

### 4. Test Symbol Search
Try these commands:
- new_search_symbol { "name": "main", "root": "${rootPath}" }
- new_search_symbol { "kind": [5, 12], "root": "${rootPath}" } (Classes and Functions)
- new_get_file_symbols { "filePath": "path/to/main/file", "root": "${rootPath}" }

### 5. Save Configuration
Write to memory the successful configuration:
- write_memory { "memoryName": "symbol_index_info", "content": "...", "root": "${rootPath}" }

Include: language, glob pattern used, total files/symbols, and any issues encountered.`;

export const symbolSearchGuidancePrompt =
  () => `When searching for symbols in the indexed codebase:

1. Use new_search_symbol for finding symbols by name:
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
   - Location information for navigation`;

export const compressionAnalysisPrompt =
  () => `To analyze token compression effectiveness:

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
   - Understanding code structure without details`;
