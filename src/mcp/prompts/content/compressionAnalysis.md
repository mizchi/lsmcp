# Token Compression Analysis Guide

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
```
measure_compression
- filePaths: ["src/components/Dashboard.tsx"]
# Typical result: 95-98% compression for component files
```

### Example 2: Complex TypeScript Module
```
measure_compression  
- filePaths: ["src/services/ApiService.ts", "src/types/ApiTypes.ts"]
# Compressions effective for: interfaces, type definitions, class methods
```

### Example 3: Batch Analysis for Optimization
```
measure_compression
- filePaths: [
    "src/utils/helpers.ts",
    "src/config/constants.ts", 
    "src/models/User.ts"
  ]
# Identify which files benefit most from compression
```

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

Compression analysis helps you work smarter, not harder! 📊