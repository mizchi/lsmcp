# LSIF Overview (Short version)

This document is a concise English summary of Microsoft’s official LSIF overview. A fuller version with diagrams and detailed specification references can be added later.

## What is it

The Language Server Index Format (LSIF) is an interchange format that enables rich code navigation (Hover, Go to Definition, Find All References, etc.) in tools or web UIs without cloning a repository locally. Language servers or other tools precompute and emit knowledge about a workspace so later services can answer LSP-equivalent queries from persisted data.

## Why it matters

Traditional LSP language servers assume local files and in-memory analysis. That is heavy or infeasible for PR reviews or browser-only views. LSIF persists precomputed results so clients can respond to queries without launching a language server at runtime.

## How it works (key points)

- Reuses LSP data types and models the results of LSP requests for later retrieval.
- Uses ranges (not single positions) to compactly associate results with identifier spans.
- Represents data as a graph: vertices (document, range, various results) and edges (contains, textDocument/hover, etc.).
- Can be emitted as a stream, enabling memory-efficient indexing for large codebases.
- Explicitly does not define language semantics or a symbol database (same non-goal as LSP).

## Representative examples (text summary)

- Hover: associate a hoverResult vertex with an identifier range via a textDocument/hover edge.
- Folding Range: associate a foldingRangeResult vertex with a document via a textDocument/foldingRange edge.

## Supported request types (per overview)

Document Symbols, Document Links, Go to Declaration, Go to Definition, Go to Type Definition, Find All References, Go to Implementation, Hover, and Folding Range. Moniker-based symbol association is included in the spec; servers should compute monikers consistently with LSP’s textDocument/moniker to link symbols across sessions and LSIF indexes.

## Relation to LSP

- LSIF does not replace LSP. It leverages LSP types and concepts to distribute precomputed results.
- This makes integration straightforward for tools and services that already understand LSP.

## Typical scenarios

- PR review and web-based code browsing with jump-to-definition and find-references.
- CI-generated LSIF indexes consumed by editors or services to answer queries quickly.

## References

- Overview: https://microsoft.github.io/language-server-protocol/overviews/lsif/overview/
- Spec 0.4.0: https://microsoft.github.io/language-server-protocol/specifications/lsif/0.4.0/specification
- LSIF Index for TypeScript: https://github.com/Microsoft/lsif-node
- VS Code extension (LSIF): https://github.com/Microsoft/vscode-lsif-extension
- Feedback issue: https://github.com/Microsoft/language-server-protocol/issues/623

## Related docs

- See Japanese version at [docs/ja/lsif-spec.md](docs/ja/lsif-spec.md)
- Moniker notes in our LSP document: [docs/lsp-spec.md](docs/lsp-spec.md)

This short version focuses on essentials. A detailed version can add vertex/edge catalogs, examples, Mermaid diagrams, optimizations, and constraints.
