# Dead Code Detection Tool Design

## Overview

This document outlines the design for implementing a TypeScript dead code detection tool in lsmcp, inspired by [TypeScript Remove (tsr)](https://github.com/line/tsr).

## Tool: `lsmcp_detect_dead_code`

### Purpose
Detect unused exports, imports, and local declarations in TypeScript projects using static analysis and dependency graph traversal.

### Core Algorithm

#### 1. Build Module Graph
```typescript
interface ModuleNode {
  path: string;
  exports: Map<string, ExportInfo>;
  imports: Map<string, ImportInfo>;
  reExports: ReExportInfo[];
  isEntryPoint: boolean;
}

interface ExportInfo {
  name: string;
  kind: 'value' | 'type' | 'namespace';
  location: Location;
  isUsed: boolean;
}

interface ImportInfo {
  source: string;
  specifiers: ImportSpecifier[];
  isUsed: boolean;
}
```

#### 2. Mark and Sweep Process

1. **Parse all TypeScript files** in the project
2. **Build dependency graph** tracking imports/exports
3. **Mark phase**: Starting from entry points, mark all reachable exports
4. **Sweep phase**: Identify all unmarked exports as dead code

#### 3. Implementation Steps

```typescript
async function detectDeadCode(config: DeadCodeConfig): Promise<DeadCodeReport> {
  // Step 1: Create TypeScript program
  const program = ts.createProgram(files, compilerOptions);
  const checker = program.getTypeChecker();
  
  // Step 2: Build module graph
  const moduleGraph = buildModuleGraph(program, checker);
  
  // Step 3: Mark reachable exports from entry points
  const entryModules = findEntryModules(moduleGraph, config.entryPoints);
  markReachableExports(moduleGraph, entryModules);
  
  // Step 4: Collect unused code
  const unusedExports = collectUnusedExports(moduleGraph);
  const unusedImports = collectUnusedImports(moduleGraph);
  const unusedLocals = collectUnusedLocals(program, checker);
  
  // Step 5: Generate report
  return generateReport({
    unusedExports,
    unusedImports,
    unusedLocals,
    moduleGraph
  });
}
```

### Key Features

#### 1. Entry Point Detection
- Support regex patterns like TSR: `'src/main\.ts$'`
- Support multiple entry points
- Auto-detect common patterns (index.ts, main.ts, cli.ts)

#### 2. Export Analysis
- Named exports: `export { foo }`
- Default exports: `export default`
- Re-exports: `export * from './module'`
- Type exports: `export type { MyType }`

#### 3. Import Analysis
- Named imports: `import { foo } from './bar'`
- Default imports: `import foo from './bar'`
- Namespace imports: `import * as foo from './bar'`
- Side-effect imports: `import './side-effects'`

#### 4. Special Cases
- Dynamic imports: Mark as potentially used
- Global augmentations: Always mark as used
- Ambient declarations: Handle `.d.ts` files specially

### Output Format

```yaml
# Dead Code Analysis Report

Project: /path/to/project
Entry Points: 
  - src/index.ts
  - src/cli.ts

Summary:
  Total Modules: 45
  Analyzed Modules: 38
  Unreachable Modules: 7
  Unused Exports: 23
  Unused Imports: 12
  Unused Local Declarations: 34

Unused Exports:
  src/utils/helpers.ts:
    - formatDate (line 23): Named export
    - parseConfig (line 45): Named export
    
  src/types/index.ts:
    - LegacyOptions (line 12): Type export

Unused Imports:
  src/api/client.ts:
    - lodash (line 3): Default import
    - { debounce } from 'lodash' (line 4): Named import

Unreachable Modules:
  - src/deprecated/old-api.ts
  - src/experimental/feature.ts
```

### Integration with LSP

Since we're moving away from ts-morph, we can potentially use LSP's workspace/symbol and textDocument/references to build the dependency graph:

1. Use `workspace/symbol` to find all exports
2. Use `textDocument/references` to find usage of each export
3. Build graph from this information

However, this might be slower than using TypeScript Compiler API directly.

### Future Enhancements

1. **Auto-fix suggestions**: Generate code actions to remove dead code
2. **Watch mode**: Continuously monitor for dead code
3. **Configuration file**: Support `.tsrconfig.json` for exclusions
4. **Metrics**: Provide code coverage-like metrics
5. **Visualization**: Generate dependency graph visualizations

### Testing Strategy

1. Create test projects with known dead code patterns
2. Verify detection accuracy
3. Test edge cases (circular dependencies, re-exports)
4. Performance testing on large codebases

### References

- [TSR GitHub Repository](https://github.com/line/tsr)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [ts-morph Dead Code Example](https://ts-morph.com/manipulation/unused)