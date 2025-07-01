# Examples for lsmcp

This directory contains example projects for testing lsmcp diagnostics across different programming languages.

## Running Tests

To test diagnostics for all example projects:

```bash
pnpm test:examples
```

The test script will automatically:

- Check if required LSP servers are installed
- Skip projects with missing dependencies
- Show installation instructions for missing dependencies
- Run diagnostics tests for available languages

## Language Support Status

| Language   | Example Project    | Test File                       | LSP Server                   | Status                                 |
| ---------- | ------------------ | ------------------------------- | ---------------------------- | -------------------------------------- |
| TypeScript | `typescript/`      | `test-diagnostics.ts`           | `typescript-language-server` | ✅ Working                             |
| Rust       | `rust-project/`    | `src/test_diagnostics.rs`       | `rust-analyzer`              | ⚠️ LSP requires initialization time    |
| MoonBit    | `moonbit-project/` | `src/test/test_diagnostics.mbt` | `moonbit-lsp`                | ⚠️ LSP diagnostics not fully supported |
| F#         | `fsharp-project/`  | `TestDiagnostics.fs`            | `fsautocomplete`             | ⚠️ LSP requires initialization time    |

## Test Files

Each example project contains a test file with intentional errors to verify that lsmcp correctly detects and reports diagnostics:

- **TypeScript**: Type errors, undefined variables, missing returns
- **Rust**: Type mismatches, borrowing errors, incomplete pattern matches
- **MoonBit**: Type errors, undefined variables, pattern matching issues
- **F#**: Type mismatches, immutable value assignments, missing return values

## Installing Language Servers

### TypeScript

```bash
npm install -g typescript-language-server typescript
```

### Rust

```bash
rustup component add rust-analyzer
```

### MoonBit

Install the MoonBit toolchain from https://www.moonbitlang.com/

### F#

```bash
dotnet tool install -g fsautocomplete
```

## Adding New Languages

To add support for a new language:

1. Add the language configuration to `src/mcp/utils/languageInit.ts`
2. Create an example project in `examples/<language-name>/`
3. Add a test file with intentional errors
4. Update the test configuration in `scripts/check-examples.ts`

## Environment Variables

- `ENABLE_PULL_DIAGNOSTICS=true` - Enable pull diagnostics (LSP 3.17+) for supported servers
- `LSP_COMMAND` - Override the default LSP command for a language
