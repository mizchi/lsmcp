# LSP Verification Scripts

This directory contains verification scripts for testing LSP server compatibility and features.

## Scripts

### test-typescript-lsp.ts
Tests typescript-language-server capabilities and verifies LocationLink format support.

```bash
npx tsx scripts/verification/test-typescript-lsp.ts
```

### test-rust-lsp.ts
Tests Rust LSP server (rust-analyzer) integration with MCP, including Go to Definition and Hover features.

```bash
npx tsx scripts/verification/test-rust-lsp.ts
```

### test-location-formats.ts
Compares definition response formats across different LSP servers to ensure compatibility.

```bash
npx tsx scripts/verification/test-location-formats.ts
```

## LocationLink vs Location Format

Modern LSP servers (typescript-language-server, rust-analyzer) return `LocationLink` format:
```typescript
{
  originSelectionRange: Range,
  targetUri: string,
  targetRange: Range,
  targetSelectionRange: Range
}
```

Older servers return `Location` format:
```typescript
{
  uri: string,
  range: Range
}
```

Our implementation automatically converts LocationLink to Location format for consistency.