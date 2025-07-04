import { defineConfig } from "vitest/config";

const GLOBAL_IGNORED_FILES = ["tmp/**", "node_modules/**", "dist/**"];

export default defineConfig({
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
          includeSource: ["src/**/*.ts"],
          include: ["src/**/*.test.ts"],
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
          name: "adapters",
          // pool: "forks",
          // poolOptions: {
          //   // minThreads: 1, // Minimum threads for adapter tests
          //   // maxThreads: 1
          // },
          include: ["tests/adapters/**/*.test.ts"],
          exclude: [...GLOBAL_IGNORED_FILES],
          testTimeout: 15000, // 15s timeout for adapter initialization tests
          retry: 0, // No retry for adapter tests
        },
      },
    ],
  },
});
