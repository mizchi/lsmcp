---
created: 2025-08-05T01:46:38.639Z
updated: 2025-08-05T01:46:38.639Z
---

# Suggested Commands

## Moonbit Development Commands

### Build
```bash
moon build              # Build the current package
moon build --target js  # Build for JavaScript target
moon build --target wasm # Build for WebAssembly target
```

### Testing
```bash
moon test               # Run tests in the current package
moon test --target js   # Run tests for JavaScript target
```

### Code Quality
```bash
moon fmt                # Format Moonbit source code
moon check              # Check the package without building
```

### Running
```bash
moon run                # Run the main package
```

### Documentation
```bash
moon doc                # Generate documentation
moon info               # Generate public interface (.mbti) files
```

### Dependency Management
```bash
moon install            # Install dependencies
moon add <dependency>   # Add a new dependency
moon tree               # Display dependency tree
```

### Cleanup
```bash
moon clean              # Remove the target directory
```

### TypeScript Commands
```bash
node test-runner.ts     # Run TypeScript test runner
node config-loader.ts   # Load configuration
```

## System Utilities
- `ls`: List files and directories
- `cd`: Change directory
- `rg`: Use ripgrep for fast file searching (preferred over grep)
- `git`: Version control commands