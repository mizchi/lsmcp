import { defineConfig } from "vitest/config";

const GLOBAL_IGNORED_FILES = ["tmp/**", "node_modules/**", "dist/**"];

export default defineConfig({
  test: {
    exclude: GLOBAL_IGNORED_FILES,
    poolOptions: {
      minThreads: 2,
      maxThreads: 6,
    },
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
          include: ["tests/integration/**/*.test.ts"],
          exclude: [
            ...GLOBAL_IGNORED_FILES,
            "tests/integration/typescript-lsp.test.ts",
          ],
          testTimeout: 10000, // 10s timeout for integration tests
        },
      },
      {
        // flaky isolated
        extends: true,
        test: {
          name: "typescript-lsp",
          include: ["tests/integration/typescript-lsp.test.ts"],
          testTimeout: 10000, // 10s timeout for integration tests
        },
      },
    ],
  },
});
