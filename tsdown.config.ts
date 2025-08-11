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
    "@lsmcp/lsp-client",
    "@lsmcp/code-indexer",
    "@lsmcp/types",
    "vscode-languageserver-types",
    "vscode-languageserver-protocol",
  ],
});
