import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    lsmcp: "src/cli/lsmcp.ts",
  },
  define: {
    "import.meta.vitest": "undefined",
  },
  // Bundle workspace packages to avoid TypeScript enum issues at runtime
  noExternal: [
    "@internal/lsp-client",
    "@internal/code-indexer",
    "@internal/types",
    "vscode-languageserver-types",
    "vscode-languageserver-protocol",
  ],
});
