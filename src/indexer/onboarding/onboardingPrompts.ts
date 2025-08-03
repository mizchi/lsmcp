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
}: OnboardingParams) => `You are viewing a code project for the first time using lsmcp's symbol indexing capabilities.
Your task is to understand the project structure and build an efficient symbol index.

Project location: ${rootPath}
System: ${system}

Step 1: Understand the project structure
- Use list_dir to explore the directory structure
- Use find_file to locate code files matching patterns (e.g., "*.ts", "*.js", "*.py")
- Identify the main source directories and file types

Step 2: Build the symbol index
- Use new_index_files to index the codebase with appropriate glob patterns
- Start with common patterns like "**/*.ts", "**/*.js" for TypeScript/JavaScript projects
- For Python projects, use "**/*.py"
- Monitor the indexing progress and check for any errors

Step 3: Verify the index
- Use new_get_index_stats to check how many files and symbols were indexed
- Use new_search_symbol to test searching for common symbol names
- Use new_get_file_symbols to examine symbols in key files

Step 4: Test symbol operations
- Try finding a class or function definition
- Search for symbols by kind (e.g., all classes, all functions)
- Verify that the symbol hierarchy is correctly captured

After completing these steps, write a summary to memory including:
- The project's main programming language(s)
- Key directories containing source code
- Recommended glob patterns for indexing
- Total number of files and symbols indexed
- Any performance considerations or limitations discovered`;

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
