# Multi-Language External Library Support Analysis

## Overview
Analysis of external library indexing feasibility for different programming languages beyond TypeScript.

## Language-Specific Analysis

### 1. Rust (rust-analyzer)

**Package System**: Cargo
**Dependencies Location**: 
- `target/debug/deps/` - Compiled dependencies
- `~/.cargo/registry/` - Global registry cache
- `Cargo.toml` - Dependency manifest

**Indexing Feasibility**: ✅ **Highly Feasible**
- rust-analyzer already provides excellent dependency analysis
- Can access symbols from crates through LSP
- Supports workspace-wide symbol search including dependencies

**Implementation Approach**:
```typescript
// Potential implementation
export async function getRustDependencies(rootPath: string): Promise<string[]> {
  const cargoTomlPath = join(rootPath, "Cargo.toml");
  // Parse Cargo.toml for dependencies
  // rust-analyzer handles symbol resolution automatically
}
```

**LSP Capabilities**:
- `workspace/symbol` - Search symbols across all crates
- `textDocument/definition` - Navigate to dependency sources
- Already indexes `.rlib` and source files from registry

### 2. Python (Pylsp/Pyright)

**Package System**: pip/poetry/conda
**Dependencies Location**:
- `site-packages/` - Installed packages
- `.venv/lib/python*/site-packages/` - Virtual environment
- `requirements.txt`/`pyproject.toml` - Dependency manifest

**Indexing Feasibility**: ✅ **Highly Feasible**
- Python packages include source `.py` files
- Type stubs (`.pyi`) similar to TypeScript `.d.ts`
- Pyright already indexes installed packages

**Implementation Approach**:
```typescript
export async function getPythonDependencies(rootPath: string): Promise<string[]> {
  // Check for virtual environment
  const venvPath = join(rootPath, ".venv", "lib");
  // Parse requirements.txt or pyproject.toml
  // Index .py and .pyi files
}
```

**Considerations**:
- Need to detect active virtual environment
- Support for type stubs from `typeshed`
- Different package managers (pip, poetry, conda)

### 3. Go (gopls)

**Package System**: Go modules
**Dependencies Location**:
- `$GOPATH/pkg/mod/` - Module cache
- `go.mod` - Module dependencies
- Vendor directory (optional)

**Indexing Feasibility**: ✅ **Highly Feasible**
- gopls already indexes all imported modules
- Excellent cross-module navigation
- Built-in support for workspace modules

**Implementation Approach**:
```typescript
export async function getGoDependencies(rootPath: string): Promise<string[]> {
  const goModPath = join(rootPath, "go.mod");
  // Parse go.mod for dependencies
  // gopls handles indexing automatically
}
```

**LSP Capabilities**:
- Automatic indexing of imported packages
- Cross-module symbol resolution
- Workspace-wide refactoring support

### 4. Java (jdtls)

**Package System**: Maven/Gradle
**Dependencies Location**:
- `.m2/repository/` - Maven local repository
- `.gradle/caches/` - Gradle cache
- `pom.xml`/`build.gradle` - Dependency manifest

**Indexing Feasibility**: ✅ **Feasible**
- JAR files contain compiled bytecode
- Can extract symbol information from `.class` files
- jdtls provides dependency analysis

**Challenges**:
- Need to handle compiled bytecode
- Source JARs may not always be available
- Complex classpath resolution

### 5. C/C++ (clangd)

**Package System**: Various (CMake, Conan, vcpkg)
**Dependencies Location**:
- System libraries
- Project-specific directories
- Package manager specific locations

**Indexing Feasibility**: ⚠️ **Moderate Complexity**
- Depends heavily on build system configuration
- Headers files provide declarations
- Requires compile_commands.json for accurate indexing

**Challenges**:
- No standard package management
- Platform-specific library locations
- Complex include path resolution

## Common Patterns Across Languages

### 1. LSP-Based Approach
Most modern language servers already handle dependency indexing:
- **Automatic**: Rust, Go, Python (Pyright)
- **Configuration-based**: Java, C/C++
- **Manual indexing needed**: Some older LSP implementations

### 2. Dependency Manifest Files
All languages have standard dependency files:
```
TypeScript: package.json
Rust:       Cargo.toml
Python:     requirements.txt / pyproject.toml
Go:         go.mod
Java:       pom.xml / build.gradle
C/C++:      CMakeLists.txt / conanfile.txt
```

### 3. Symbol Resolution Patterns
Common approaches for symbol resolution:
1. **Source-based**: Direct access to source code (Python, Go, TypeScript)
2. **Metadata-based**: Parse compiled artifacts (Java .class, Rust .rlib)
3. **Header-based**: Parse declaration files (C/C++ headers, Python .pyi)

## Implementation Strategy

### Generic External Library Provider Interface

```typescript
interface ExternalLibraryProvider {
  // Detect if this provider can handle the project
  canHandle(rootPath: string): Promise<boolean>;
  
  // Get list of dependencies
  getDependencies(rootPath: string): Promise<DependencyInfo[]>;
  
  // Get symbols from a dependency
  getSymbols(dependency: DependencyInfo): Promise<SymbolEntry[]>;
  
  // Resolve import/require statements
  resolveImport(importPath: string, fromFile: string): Promise<string | null>;
}

interface DependencyInfo {
  name: string;
  version: string;
  location: string;
  type: 'source' | 'compiled' | 'stub';
}
```

### Language-Specific Implementations

```typescript
// Factory pattern for language-specific providers
export function createExternalLibraryProvider(
  languageId: string
): ExternalLibraryProvider | null {
  switch (languageId) {
    case 'typescript':
    case 'javascript':
      return new TypeScriptExternalProvider();
    case 'rust':
      return new RustExternalProvider();
    case 'python':
      return new PythonExternalProvider();
    case 'go':
      return new GoExternalProvider();
    default:
      return null;
  }
}
```

## Recommendations

### Priority Languages for Implementation

1. **Rust** (High Priority)
   - Clean module system
   - Excellent LSP support
   - Growing ecosystem
   
2. **Python** (High Priority)
   - Large user base
   - Clear package structure
   - Good type stub support

3. **Go** (Medium Priority)
   - Simple module system
   - Built-in LSP support
   - Standardized structure

4. **Java** (Lower Priority)
   - Complex but feasible
   - Requires bytecode handling
   - Multiple build systems

5. **C/C++** (Lowest Priority)
   - Most complex
   - No standard package management
   - Platform-specific challenges

### Implementation Approach

1. **Leverage Existing LSP Capabilities**
   - Most language servers already index dependencies
   - Use `workspace/symbol` for cross-module search
   - Rely on LSP for symbol resolution when possible

2. **Fallback to Manual Indexing**
   - Parse dependency manifests
   - Scan known dependency locations
   - Build custom symbol tables only when necessary

3. **Unified Interface**
   - Create common abstraction for all languages
   - Allow language-specific optimizations
   - Support gradual rollout of features

## Conclusion

External library indexing is **feasible for most modern languages**, with varying levels of complexity:

- **Easy**: Rust, Go, Python (with Pyright)
- **Moderate**: Java, Python (with other LSPs)
- **Complex**: C/C++

The key is to:
1. Leverage existing LSP capabilities where possible
2. Provide language-specific implementations
3. Create a unified interface for consistency
4. Start with languages that have clean module systems