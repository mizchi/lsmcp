import type { CompletionItem, Position } from "vscode-languageserver-types";
import type {
  CompletionParams,
  CompletionResult,
  LSPCommand,
} from "./types.ts";
import { isCompletionList } from "./types.ts";
import type { LSPClient } from "../lspTypes.ts";

export function createCompletionCommand(): LSPCommand<
  CompletionParams,
  CompletionItem[]
> {
  return {
    method: "textDocument/completion",

    buildParams(input: CompletionParams) {
      return {
        textDocument: { uri: input.uri },
        position: input.position,
      };
    },

    processResponse(response: CompletionResult): CompletionItem[] {
      if (!response) {
        return [];
      }

      // Handle CompletionList
      if (isCompletionList(response)) {
        return response.items;
      }

      // Handle CompletionItem[]
      if (Array.isArray(response)) {
        return response;
      }

      return [];
    },
  };
}

export function createCompletionResolveCommand(): LSPCommand<
  CompletionItem,
  CompletionItem
> {
  return {
    method: "completionItem/resolve",

    buildParams(input: CompletionItem) {
      return input;
    },

    processResponse(response: unknown): CompletionItem {
      // If resolve fails or returns null, return the original item
      return (response as CompletionItem) || ({} as CompletionItem);
    },
  };
}

/**
 * Completion handler interface
 */
export interface CompletionHandler {
  /**
   * Get completion items at a specific position
   */
  getCompletion(uri: string, position: Position): Promise<CompletionItem[]>;

  /**
   * Resolve a completion item for additional details
   */
  resolveCompletionItem(item: CompletionItem): Promise<CompletionItem>;
}

/**
 * Create a completion handler for the given LSP client
 */
export function createCompletionHandler(client: LSPClient): CompletionHandler {
  const completionCommand = createCompletionCommand();
  const resolveCommand = createCompletionResolveCommand();

  async function getCompletion(
    uri: string,
    position: Position,
  ): Promise<CompletionItem[]> {
    const params = completionCommand.buildParams({ uri, position });
    const result = await client.sendRequest<CompletionResult>(
      completionCommand.method,
      params as Record<string, unknown>,
    );
    return completionCommand.processResponse(result);
  }

  async function resolveCompletionItem(
    item: CompletionItem,
  ): Promise<CompletionItem> {
    try {
      const params = resolveCommand.buildParams(item);
      const result = await client.sendRequest<CompletionItem>(
        resolveCommand.method,
        params as Record<string, unknown>,
      );
      return resolveCommand.processResponse(result) || item;
    } catch {
      // If resolve fails, return the original item
      return item;
    }
  }

  return {
    getCompletion,
    resolveCompletionItem,
  };
}

/**
 * Advanced completion handler options
 */
export interface AdvancedCompletionOptions {
  resolveAll?: boolean;
  filterAutoImports?: boolean;
  maxItems?: number;
}

/**
 * Create an advanced completion handler with support for incremental completion
 * and automatic import resolution
 */
export function createAdvancedCompletionHandler(client: LSPClient) {
  const handler = createCompletionHandler(client);

  /**
   * Sort completions by relevance
   */
  function sortCompletions(items: CompletionItem[]): CompletionItem[] {
    return [...items].sort((a, b) => {
      // First, sort by sortText if available
      if (a.sortText && b.sortText) {
        return a.sortText.localeCompare(b.sortText);
      }

      // Then by preselect flag
      if (a.preselect !== b.preselect) {
        return a.preselect ? -1 : 1;
      }

      // Finally by label
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Check if a completion item has auto-import information
   */
  function hasAutoImport(item: CompletionItem): boolean {
    // Check for additional text edits (usually imports)
    if (item.additionalTextEdits && item.additionalTextEdits.length > 0) {
      return item.additionalTextEdits.some((edit) => {
        const text = edit.newText;
        return text.includes("import") || text.includes("from");
      });
    }

    // Check detail field for import information
    if (item.detail) {
      return item.detail.includes("import") || item.detail.includes("from");
    }

    return false;
  }

  /**
   * Get completions with automatic resolution of import items
   */
  async function getCompletionsWithImports(
    uri: string,
    position: Position,
    options: AdvancedCompletionOptions = {},
  ): Promise<CompletionItem[]> {
    const {
      resolveAll = false,
      filterAutoImports = false,
      maxItems = 20,
    } = options;

    // Get initial completions
    const completions = await handler.getCompletion(uri, position);

    if (completions.length === 0) {
      return [];
    }

    // Sort completions by relevance
    const sorted = sortCompletions(completions);

    // Take top N items
    const topItems = sorted.slice(0, maxItems);

    // Resolve items if requested
    let resolvedItems = topItems;
    if (resolveAll) {
      resolvedItems = await Promise.all(
        topItems.map((item) => handler.resolveCompletionItem(item)),
      );
    }

    // Filter for auto-import items if requested
    if (filterAutoImports) {
      return resolvedItems.filter((item) => hasAutoImport(item));
    }

    return resolvedItems;
  }

  return {
    ...handler,
    getCompletionsWithImports,
  };
}

// Test helpers for vitest
export const testHelpers = {
  createMockCompletionItem(
    overrides: Partial<CompletionItem> = {},
  ): CompletionItem {
    return {
      label: "testItem",
      kind: 1, // Text
      ...overrides,
    };
  },

  createMockCompletionList(items: CompletionItem[]) {
    return {
      isIncomplete: false,
      items,
    };
  },
};

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("CompletionCommand", () => {
    const command = createCompletionCommand();

    describe("buildParams", () => {
      it("should build correct parameters", () => {
        const params = command.buildParams({
          uri: "file:///test.ts",
          position: { line: 10, character: 5 },
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          position: { line: 10, character: 5 },
        });
      });
    });

    describe("processResponse", () => {
      it("should handle null response", () => {
        const result = command.processResponse(null);
        expect(result).toEqual([]);
      });

      it("should handle CompletionItem array", () => {
        const items: CompletionItem[] = [
          { label: "item1", kind: 1 },
          { label: "item2", kind: 2 },
        ];

        const result = command.processResponse(items);
        expect(result).toEqual(items);
      });

      it("should handle CompletionList", () => {
        const items: CompletionItem[] = [
          { label: "item1", kind: 1 },
          { label: "item2", kind: 2 },
        ];

        const result = command.processResponse({
          isIncomplete: false,
          items,
        });

        expect(result).toEqual(items);
      });

      it("should handle empty CompletionList", () => {
        const result = command.processResponse({
          isIncomplete: false,
          items: [],
        });

        expect(result).toEqual([]);
      });
    });
  });

  describe("CompletionResolveCommand", () => {
    const command = createCompletionResolveCommand();

    describe("buildParams", () => {
      it("should pass through the completion item", () => {
        const item: CompletionItem = {
          label: "test",
          kind: 1,
          data: { someData: true },
        };

        const params = command.buildParams(item);
        expect(params).toEqual(item);
      });
    });

    describe("processResponse", () => {
      it("should return resolved item", () => {
        const resolved: CompletionItem = {
          label: "test",
          kind: 1,
          detail: "Resolved detail",
          documentation: "Resolved docs",
        };

        const result = command.processResponse(resolved);
        expect(result).toEqual(resolved);
      });

      it("should handle null response", () => {
        const result = command.processResponse(null);
        expect(result).toEqual({});
      });

      it("should handle undefined response", () => {
        const result = command.processResponse(undefined);
        expect(result).toEqual({});
      });
    });
  });
}
