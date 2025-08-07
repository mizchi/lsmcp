# Contributing to lsmcp

Thank you for your interest in contributing to lsmcp! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Language Adapter Development](#language-adapter-development)
- [Testing](#testing)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 9.15.0+
- Git

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/mizchi/lsmcp.git
cd lsmcp

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test
```

### Development Commands

```bash
pnpm build         # Build the project
pnpm test          # Run all tests
pnpm test:unit     # Run unit tests only
pnpm test:integration # Run integration tests only
pnpm lint          # Run linter (oxlint)
pnpm typecheck     # Type check with tsgo
pnpm format        # Format code with Biome
```

## Project Structure

```
lsmcp/
├── src/
│   ├── adapters/      # Language-specific LSP adapters
│   ├── cli/           # CLI implementation
│   ├── constants/     # Constants and defaults
│   ├── core/          # Core functionality
│   ├── indexer/       # Symbol indexing system
│   ├── lsp/           # LSP client and tools
│   ├── mcp/           # MCP server implementation
│   ├── prompts/       # AI prompts and guidance
│   ├── ts/            # TypeScript-specific utilities
│   └── types/         # TypeScript type definitions
├── tests/
│   ├── adapters/      # Adapter-specific tests
│   └── integration/   # Integration tests
├── examples/          # Example projects for each language
└── .lsmcp/           # Project configuration and memories
```

## Language Adapter Development

### Adding a New Language Adapter

1. Create a new adapter file in `src/adapters/`:

```typescript
// src/adapters/myLanguage.ts
import type { LspAdapter } from "../types/lsp.ts";

export const myLanguageAdapter: LspAdapter = {
  id: "my-language",
  name: "My Language",
  fileExtensions: [".ml", ".mli"],
  defaultBin: "my-language-server",
  defaultArgs: ["--stdio"],
  initializationOptions: {
    // Language-specific initialization options
  },
  serverCharacteristics: {
    // Optional server-specific behavior
  },
  doctor: async () => {
    // Health check implementation
    return { success: true, message: "My Language LSP is ready" };
  },
};
```

2. Register the adapter in `src/adapters/registry.ts`
3. Add tests in `tests/adapters/language-tests/`
4. Create an example project in `examples/my-language/`

### Language-Specific Setup Instructions

#### TypeScript/JavaScript

**Prerequisites:**
- Node.js 22+

**Installation:**
```bash
# Option 1: typescript-language-server (stable)
npm install -g typescript typescript-language-server

# Option 2: tsgo (faster, experimental)
npm install -g @typescript/native-preview
```

**Testing:**
```bash
pnpm test tests/adapters/language-tests/typescript.test.ts
pnpm test tests/adapters/language-tests/tsgo.test.ts
```

#### Rust

**Prerequisites:**
- Rust toolchain (via rustup)

**Installation:**
```bash
# Install Rust and rust-analyzer
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup component add rust-analyzer
```

**Testing:**
```bash
# Initialize test project
cd tests/adapters/fixtures/rust
cargo check

# Run tests
pnpm test tests/adapters/language-tests/rust.test.ts
```

#### Python

**Prerequisites:**
- Python 3.8+

**Installation:**
```bash
# Option 1: Pyright (recommended)
npm install -g pyright

# Option 2: python-lsp-server
pip install python-lsp-server[all]

# Option 3: Using uv (fast package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install python-lsp-server[all]
```

**Testing:**
```bash
# Initialize test project (if using uv)
cd tests/adapters/fixtures/python
uv sync

# Run tests
pnpm test tests/adapters/language-tests/python.test.ts
```

#### F#

**Prerequisites:**
- .NET SDK 8.0+

**Installation:**
```bash
# Install .NET SDK
# See: https://dotnet.microsoft.com/download

# Install fsautocomplete
dotnet tool install -g fsautocomplete
```

**Testing:**
```bash
pnpm test tests/adapters/language-tests/fsharp.test.ts
```

#### Go

**Prerequisites:**
- Go 1.19+

**Installation:**
```bash
# Install Go
# See: https://go.dev/doc/install

# Install gopls
go install golang.org/x/tools/gopls@latest
```

**Testing:**
```bash
pnpm test tests/adapters/language-tests/go.test.ts
```

#### MoonBit

**Prerequisites:**
- MoonBit CLI

**Installation:**
```bash
# Install MoonBit
curl -fsSL https://cli.moonbitlang.com/install/unix.sh | bash
export PATH="$HOME/.moon/bin:$PATH"
```

**Testing:**
```bash
pnpm test tests/adapters/language-tests/moonbit.test.ts
```

### CI Environment Variables

When running tests in CI, set the following environment variables:

```bash
TEST_TYPESCRIPT=true  # Enable TypeScript tests
TEST_TSGO=true       # Enable tsgo tests
TEST_RUST=true       # Enable Rust tests
TEST_PYTHON=true     # Enable Python tests
TEST_FSHARP=true     # Enable F# tests
TEST_GO=true         # Enable Go tests
TEST_MOONBIT=true    # Enable MoonBit tests
```

## Testing

### Test Structure

```
tests/
├── adapters/
│   ├── fixtures/      # Test projects for each language
│   └── language-tests/ # Language-specific adapter tests
├── integration/       # MCP server integration tests
└── unit/             # Unit tests (in src/)
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test path/to/test.ts

# Run with coverage
pnpm test --coverage

# Run in watch mode
pnpm test --watch
```

### Writing Tests

Tests use Vitest. Example:

```typescript
import { describe, it, expect } from "vitest";

describe("MyFeature", () => {
  it("should work correctly", () => {
    expect(myFunction()).toBe(expectedResult);
  });
});
```

## Code Style

### General Guidelines

- **Language**: All code, comments, and documentation must be in English
- **File naming**: Use lowerCamelCase (e.g., `symbolIndex.ts`)
- **Imports**: Use `.ts` extensions for Deno compatibility
- **TypeScript**: Use strict mode
- **Interfaces vs Types**: Prefer interfaces for object definitions
- **Async**: Use async/await over promises

### Important Rules

- **NEVER** add comments unless explicitly requested
- **NEVER** create documentation files unless requested
- **ALWAYS** run `pnpm build` before integration tests
- **ALWAYS** run `pnpm lint` and `pnpm typecheck` before committing
- **USE** `rg` (ripgrep) instead of `grep` for searching

### Git Commit Messages

Follow conventional commits format:

```
feat: add new feature
fix: fix bug in X
docs: update documentation
test: add tests for Y
refactor: refactor Z
chore: update dependencies
```

## Pull Request Process

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/lsmcp.git
   cd lsmcp
   git remote add upstream https://github.com/mizchi/lsmcp.git
   ```

2. **Create Branch**
   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/issue-123
   ```

3. **Make Changes**
   - Write code
   - Add tests
   - Update documentation if needed

4. **Test and Lint**
   ```bash
   pnpm build
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

5. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   git push origin feat/my-feature
   ```

6. **Create Pull Request**
   - Target the `main` branch
   - Provide clear description
   - Reference any related issues

### PR Review Checklist

- [ ] Tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Code is formatted (`pnpm format`)
- [ ] Documentation is updated (if needed)
- [ ] Commit messages follow conventions

## Advanced Configuration

### Using Configuration Files

Create `.lsmcp/config.json` in your project:

```json
{
  "$schema": "../node_modules/@mizchi/lsmcp/lsmcp.schema.json",
  "preset": "typescript",
  "settings": {
    "autoIndex": true,
    "indexConcurrency": 10
  },
  "lsp": {
    "bin": "custom-lsp-server",
    "args": ["--stdio"],
    "initializationOptions": {
      "customOption": true
    }
  }
}
```

### Environment Variables

```bash
# Debug logging
DEBUG=lsmcp:* pnpm test

# Force specific LSP
FORCE_LSP=typescript pnpm test

# Custom LSP command
LSP_COMMAND="my-lsp --stdio" pnpm test
```

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/mizchi/lsmcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mizchi/lsmcp/discussions)
- **Documentation**: [README.md](README.md), [CLAUDE.md](CLAUDE.md)

## License

By contributing to lsmcp, you agree that your contributions will be licensed under the MIT License.