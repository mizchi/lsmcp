/**
 * MCP Prompt handlers for lsmcp
 */

import { z } from "zod";
import { createPrompt, type McpPromptDef } from "./promptDefinitions.ts";
import {
  symbolIndexOnboardingPrompt,
  symbolSearchGuidancePrompt,
  compressionAnalysisPrompt,
} from "../../features/memory/onboarding/onboardingPrompts.ts";
import {
  onboardingMarkdown,
  codeAnalysisMarkdown,
  symbolSearchMarkdown,
  compressionAnalysisMarkdown,
} from "./content/markdownContent.ts";

/**
 * Onboarding prompt schema
 */
const onboardingSchema = z.object({
  projectPath: z
    .string()
    .optional()
    .describe("Project root path (defaults to current working directory)"),
  language: z
    .string()
    .optional()
    .describe(
      "Primary language of the project (typescript, python, rust, etc.)",
    ),
});

/**
 * Code analysis prompt schema
 */
const codeAnalysisSchema = z.object({
  projectPath: z
    .string()
    .optional()
    .describe("Project root path (defaults to current working directory)"),
  language: z.string().optional().describe("Target language for analysis"),
  goal: z.string().optional().describe("Specific analysis goal or focus area"),
  pattern: z
    .string()
    .optional()
    .describe("File pattern to analyze (e.g., 'src/**/*.ts')"),
});

/**
 * Symbol search guidance prompt schema
 */
const symbolSearchSchema = z.object({
  includeAdvanced: z
    .boolean()
    .optional()
    .describe("Include advanced search techniques"),
});

/**
 * Compression analysis prompt schema
 */
const compressionAnalysisPromptSchema = z.object({
  includeExamples: z.boolean().optional().describe("Include usage examples"),
});

/**
 * LSMCP Onboarding prompt
 * Provides interactive project setup guide
 */
export const lsmcpOnboardingPrompt: McpPromptDef<typeof onboardingSchema> =
  createPrompt({
    name: "lsmcp_onboarding",
    description:
      "Interactive guide for setting up LSMCP symbol indexing in your project",
    schema: onboardingSchema,
    execute: async (args) => {
      const projectPath = args.projectPath || process.cwd();
      const system = `LSMCP v0.10.0 - Symbol Indexing Setup`;

      const basePrompt = symbolIndexOnboardingPrompt({
        system,
        rootPath: projectPath,
      });

      let languageSpecificGuidance = "";
      if (args.language) {
        switch (args.language.toLowerCase()) {
          case "typescript":
          case "javascript":
            languageSpecificGuidance = `

## TypeScript/JavaScript Specific Setup

For optimal TypeScript support:
1. Ensure you have tsconfig.json in your project root
2. Use pattern: "**/*.{ts,tsx,js,jsx}" for indexing
3. Consider excluding test files: "src/**/*.{ts,tsx}" 
4. LSMCP works best with TypeScript Language Server (tsserver)

Example indexing command:
- index_files { "pattern": "src/**/*.{ts,tsx}", "root": "${projectPath}" }`;
            break;
          case "python":
            languageSpecificGuidance = `

## Python Specific Setup

For optimal Python support:
1. Ensure you have a virtual environment activated
2. Use pattern: "**/*.py" for indexing
3. Consider excluding __pycache__: "src/**/*.py"
4. LSMCP works with Pylsp, Pyright, or other Python language servers

Example indexing command:
- index_files { "pattern": "**/*.py", "root": "${projectPath}" }`;
            break;
          case "rust":
            languageSpecificGuidance = `

## Rust Specific Setup

For optimal Rust support:
1. Ensure you have rust-analyzer installed
2. Use pattern: "**/*.rs" for indexing
3. Include both src/ and tests/: "**/*.rs"
4. LSMCP integrates with rust-analyzer for rich symbol information

Example indexing command:
- index_files { "pattern": "**/*.rs", "root": "${projectPath}" }`;
            break;
        }
      }

      return (
        basePrompt +
        languageSpecificGuidance +
        `

## Next Steps After Setup

Once you've completed the onboarding:
1. Use /mcp__lsmcp__symbol_search_guide for advanced search techniques
2. Use /mcp__lsmcp__analyze_code for systematic code analysis
3. Use /mcp__lsmcp__compression_analysis to understand token efficiency

Project Path: ${projectPath}
${args.language ? `Language: ${args.language}` : ""}

Ready to start your LSMCP journey! 🚀`
      );
    },
  });

/**
 * Code Analysis prompt
 * Provides systematic code analysis workflow
 */
export const codeAnalysisPrompt: McpPromptDef<typeof codeAnalysisSchema> =
  createPrompt({
    name: "analyze_code",
    description:
      "Systematic code analysis workflow using LSMCP's LSP integration",
    schema: codeAnalysisSchema,
    execute: async (args) => {
      const projectPath = args.projectPath || process.cwd();
      const language = args.language || "typescript";
      const goal = args.goal || "Find errors and analyze code quality";
      const pattern = args.pattern || "**/*.{ts,tsx,js,jsx}";

      // Determine adapter name based on language
      let adapterName = "tsgo-dev"; // default
      switch (language.toLowerCase()) {
        case "python":
          adapterName = "python-dev";
          break;
        case "rust":
          adapterName = "rust-dev";
          break;
        case "go":
          adapterName = "go-dev";
          break;
        case "fsharp":
        case "f#":
          adapterName = "fsharp-dev";
          break;
      }

      return `# Rapid Code Analysis Task

Project Root: ${projectPath}
Target Language: ${language}
Analysis Goal: ${goal}
File Pattern: ${pattern}

Execute the following analysis phases:

## Phase 1: Capability Check (5 seconds)
Verify available LSP features:
\`\`\`
mcp__lsmcp-${adapterName}__check_capabilities
\`\`\`

## Phase 2: Project-wide Diagnostics (10 seconds)
Collect all errors and warnings:
\`\`\`
mcp__lsmcp-${adapterName}__get_all_diagnostics
- root: "${projectPath}"
- pattern: "${pattern}"
- severityFilter: "error"  # Start with errors only
- useGitignore: true
\`\`\`

If few errors found, repeat with severityFilter: "warning"

## Phase 3: Symbol Analysis (5 seconds per symbol)
For critical functions/classes:
\`\`\`
mcp__lsmcp-${adapterName}__find_references
- root: "${projectPath}"
- filePath: "<RELATIVE_FILE_PATH>"
- line: <LINE_NUMBER>
- symbolName: "<SYMBOL_NAME>"
\`\`\`

## Phase 4: Type Verification (3 seconds per location)
For suspicious code locations:
\`\`\`
mcp__lsmcp-${adapterName}__get_hover
- root: "${projectPath}"
- filePath: "<RELATIVE_FILE_PATH>"
- line: <LINE_NUMBER>
- target: "<CODE_SNIPPET>"
\`\`\`

## Phase 5: Unused Code Detection
Identify symbols with zero references:
\`\`\`
mcp__lsmcp-${adapterName}__find_references
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

Ready to analyze ${projectPath} with ${language} language support! 🔍`;
    },
  });

/**
 * Symbol Search Guidance prompt
 */
export const symbolSearchGuidePrompt: McpPromptDef<typeof symbolSearchSchema> =
  createPrompt({
    name: "symbol_search_guide",
    description:
      "Comprehensive guide for symbol search and navigation in indexed codebases",
    schema: symbolSearchSchema,
    execute: async (args) => {
      const baseGuide = symbolSearchGuidancePrompt();

      let advancedSection = "";
      if (args.includeAdvanced) {
        advancedSection = `

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
- root: "/project/path"
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
- "Service" → find all service classes`;
      }

      return (
        baseGuide +
        advancedSection +
        `

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

Happy symbol hunting! 🎯`
      );
    },
  });

/**
 * Compression Analysis prompt
 */
export const compressionAnalysisGuidePrompt: McpPromptDef<
  typeof compressionAnalysisPromptSchema
> = createPrompt({
  name: "compression_analysis",
  description:
    "Guide for analyzing token compression effectiveness in codebases",
  schema: compressionAnalysisPromptSchema,
  execute: async (args) => {
    const baseGuide = compressionAnalysisPrompt();

    let examplesSection = "";
    if (args.includeExamples) {
      examplesSection = `

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
- Security audit requirements`;
    }

    return (
      baseGuide +
      examplesSection +
      `

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

Compression analysis helps you work smarter, not harder! 📊`
    );
  },
});

/**
 * Enhanced onboarding prompt using markdown content
 */
export const enhancedOnboardingPrompt: McpPromptDef<typeof onboardingSchema> =
  createPrompt({
    name: "enhanced_onboarding",
    description:
      "Enhanced interactive guide for setting up LSMCP symbol indexing with markdown content",
    schema: onboardingSchema,
    execute: async (args) => {
      const projectPath = args.projectPath || process.cwd();
      let languageSpecificGuidance = "";

      if (args.language) {
        switch (args.language.toLowerCase()) {
          case "typescript":
          case "javascript":
            languageSpecificGuidance = `

## TypeScript/JavaScript Specific Setup

For optimal TypeScript support:
1. Ensure you have tsconfig.json in your project root
2. Use pattern: "**/*.{ts,tsx,js,jsx}" for indexing
3. Consider excluding test files: "src/**/*.{ts,tsx}" 
4. LSMCP works best with TypeScript Language Server (tsserver)

Example indexing command:
- index_files { "pattern": "src/**/*.{ts,tsx}", "root": "${projectPath}" }`;
            break;
          case "python":
            languageSpecificGuidance = `

## Python Specific Setup

For optimal Python support:
1. Ensure you have a virtual environment activated
2. Use pattern: "**/*.py" for indexing
3. Consider excluding __pycache__: "src/**/*.py"
4. LSMCP works with Pylsp, Pyright, or other Python language servers

Example indexing command:
- index_files { "pattern": "**/*.py", "root": "${projectPath}" }`;
            break;
        }
      }

      return `${onboardingMarkdown}

Project Path: ${projectPath}
${args.language ? `Language: ${args.language}` : ""}

${languageSpecificGuidance}`;
    },
  });

/**
 * Enhanced code analysis prompt using markdown content
 */
export const enhancedCodeAnalysisPrompt: McpPromptDef<
  typeof codeAnalysisSchema
> = createPrompt({
  name: "enhanced_code_analysis",
  description:
    "Enhanced systematic code analysis workflow using markdown content",
  schema: codeAnalysisSchema,
  execute: async (args) => {
    const projectPath = args.projectPath || process.cwd();
    const language = args.language || "typescript";
    const goal = args.goal || "Find errors and analyze code quality";
    const pattern = args.pattern || "**/*.{ts,tsx,js,jsx}";

    return `# Enhanced Code Analysis for ${projectPath}

**Target Language**: ${language}  
**Analysis Goal**: ${goal}  
**File Pattern**: ${pattern}

${codeAnalysisMarkdown}`;
  },
});

/**
 * Enhanced symbol search guide using markdown content
 */
export const enhancedSymbolSearchPrompt: McpPromptDef<
  typeof symbolSearchSchema
> = createPrompt({
  name: "enhanced_symbol_search",
  description:
    "Enhanced comprehensive guide for symbol search using markdown content",
  schema: symbolSearchSchema,
  execute: async (args) => {
    let content = symbolSearchMarkdown;

    if (!args.includeAdvanced) {
      // Remove advanced section if not requested
      const advancedIndex = content.indexOf("## Advanced Search Techniques");
      if (advancedIndex !== -1) {
        content = content.substring(0, advancedIndex).trim();
      }
    }

    return content;
  },
});

/**
 * Enhanced compression analysis guide using markdown content
 */
export const enhancedCompressionAnalysisPrompt: McpPromptDef<
  typeof compressionAnalysisPromptSchema
> = createPrompt({
  name: "enhanced_compression_analysis",
  description:
    "Enhanced guide for analyzing token compression using markdown content",
  schema: compressionAnalysisPromptSchema,
  execute: async (args) => {
    let content = compressionAnalysisMarkdown;

    if (!args.includeExamples) {
      // Remove examples section if not requested
      const examplesIndex = content.indexOf("## Practical Examples");
      if (examplesIndex !== -1) {
        const nextSectionIndex = content.indexOf(
          "## Compression Effectiveness",
          examplesIndex,
        );
        if (nextSectionIndex !== -1) {
          content =
            content.substring(0, examplesIndex) +
            content.substring(nextSectionIndex);
        }
      }
    }

    return content;
  },
});

/**
 * Export all prompt handlers
 */
export const promptHandlers: McpPromptDef<any>[] = [
  // Original prompts
  lsmcpOnboardingPrompt as McpPromptDef<any>,
  codeAnalysisPrompt as McpPromptDef<any>,
  symbolSearchGuidePrompt as McpPromptDef<any>,
  compressionAnalysisGuidePrompt as McpPromptDef<any>,
  // Enhanced markdown-based prompts
  enhancedOnboardingPrompt as McpPromptDef<any>,
  enhancedCodeAnalysisPrompt as McpPromptDef<any>,
  enhancedSymbolSearchPrompt as McpPromptDef<any>,
  enhancedCompressionAnalysisPrompt as McpPromptDef<any>,
];
