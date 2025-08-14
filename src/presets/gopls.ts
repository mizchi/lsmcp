import type { Preset } from "../config/schema.ts";

/**
 * Gopls adapter for Go language support
 * @see https://pkg.go.dev/golang.org/x/tools/gopls
 */
export const goplsAdapter: Preset = {
  presetId: "gopls",
  bin: "gopls",
  args: ["serve"],
  files: ["**/*.go", "go.mod", "go.sum"],
  initializationOptions: {
    // Enable all gopls features
    codelenses: {
      gc_details: true,
      generate: true,
      regenerate_cgo: true,
      run_govulncheck: true,
      test: true,
      tidy: true,
      upgrade_dependency: true,
      vendor: true,
    },
    analyses: {
      unusedparams: true,
      unusedwrite: true,
      useany: true,
    },
    staticcheck: true,
    gofumpt: true,
    semanticTokens: true,
    noSemanticString: false,
    usePlaceholders: true,
    completeUnimported: true,
    completionBudget: "500ms",
  },
};
