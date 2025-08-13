import { defineConfig } from "vitest/config";
import path from "node:path";

const GLOBAL_IGNORED_FILES = ["tmp/**", "node_modules/**", "dist/**", "**/node_modules/**"];

export default defineConfig({
  resolve: {
    alias: [
      // Runtime alias for the new package entry
      {
        find: "@lsmcp/code-indexer",
        replacement: path.resolve(__dirname, "packages/code-indexer/src/index.ts"),
      },
      {
        find: "@lsmcp/lsp-client",
        replacement: path.resolve(__dirname, "packages/lsp-client/src/index.ts"),
      },
      // Alias to access repo root src as "lsmcp/*" from packages
      {
        find: /^lsmcp\//,
        replacement: path.resolve(__dirname, "src/") + "/",
      },
    ],
  },
  test: {
    exclude: GLOBAL_IGNORED_FILES,
    poolOptions: {
      minThreads: 2,
      maxThreads: 6,
    },
    setupFiles: ["./tests/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          includeSource: ["src/**/*.ts", "packages/**/*.ts"],
          include: ["src/**/*.test.ts", "packages/**/*.test.ts"],
          exclude: [
            ...GLOBAL_IGNORED_FILES,
            // These files contain LSP integration tests that should not run as unit tests
            "src/tools/lsp/definitions.ts",
            "src/tools/lsp/diagnostics.ts",
            "src/tools/lsp/hover.ts",
            "src/tools/lsp/references.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts", "tests/*.test.ts"],
          exclude: [
            ...GLOBAL_IGNORED_FILES,
            "tests/integration/typescript-lsp.test.ts",
          ],
          testTimeout: 10000, // 10s timeout for integration tests
          // Retry flaky tests up to 2 times due to timing-sensitive LSP operations
          retry: 2,
        },
      },
      {
        extends: true,
        test: {
          name: "languages",
          include: ["tests/languages/**/*.test.ts"],
          exclude: [...GLOBAL_IGNORED_FILES],
          testTimeout: 15000, // 15s timeout for language initialization tests
          retry: 0, // No retry for language tests
        },
      },
      {
        extends: true,
        test: {
          name: "bench",
          include: ["src/**/*.bench.ts"],
          exclude: [...GLOBAL_IGNORED_FILES],
          benchmark: {
            outputFile: "./bench-results.json",
          },
        },
      },
      {
        extends: true,
        test: {
          name: "lsp-client",
          include: ["packages/lsp-client/**/*.test.ts"],
          exclude: [...GLOBAL_IGNORED_FILES],
          testTimeout: 10000,
        },
      },
    ],
  },
});
