# Rapid Code Analysis Task

Execute the following analysis phases:

## Phase 1: Capability Check (5 seconds)
Verify available LSP features:
```
check_capabilities
```

## Phase 2: Project-wide Diagnostics (10 seconds)
Collect all errors and warnings:
```
get_all_diagnostics
- pattern: "**/*.{ts,tsx,js,jsx}"
- severityFilter: "error"  # Start with errors only
- useGitignore: true
```

If few errors found, repeat with severityFilter: "warning"

## Phase 3: Symbol Analysis (5 seconds per symbol)
For critical functions/classes:
```
find_references
- filePath: "<RELATIVE_FILE_PATH>"
- line: <LINE_NUMBER>
- symbolName: "<SYMBOL_NAME>"
```

## Phase 4: Type Verification (3 seconds per location)
For suspicious code locations:
```
get_hover
- filePath: "<RELATIVE_FILE_PATH>"
- line: <LINE_NUMBER>
- target: "<CODE_SNIPPET>"
```

## Phase 5: Unused Code Detection
Identify symbols with zero references:
```
find_references
- Check exported functions/classes
- Flag items with 0 references
```

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

Ready to analyze your codebase! 🔍