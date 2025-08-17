import type { FileSymbols } from "./types.ts";

/**
 * Create a minimal FileSymbols object for testing
 */
export function createTestFileSymbols(overrides?: Partial<FileSymbols>): FileSymbols {
  return {
    uri: "file:///test.ts",
    symbols: [],
    lastModified: Date.now(),
    lastIndexed: Date.now(),
    gitHash: undefined,
    contentHash: undefined,
    ...overrides,
  };
}