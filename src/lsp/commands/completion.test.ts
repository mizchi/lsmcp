import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdvancedCompletionHandler,
  createCompletionHandler,
  testHelpers,
} from "./completion.ts";
import type { CompletionItem } from "vscode-languageserver-types";
import type { LSPClient } from "../lspTypes.ts";

// Tests for completion handlers (more complex, kept in separate file)
describe("completionHandler", () => {
  let mockClient: Partial<LSPClient>;

  beforeEach(() => {
    mockClient = {
      sendRequest: vi.fn(),
    };
  });

  describe("createCompletionHandler", () => {
    it("should handle CompletionItem[] response", async () => {
      const items: CompletionItem[] = [
        testHelpers.createMockCompletionItem({ label: "item1" }),
        testHelpers.createMockCompletionItem({ label: "item2" }),
      ];

      vi.mocked(mockClient.sendRequest!).mockResolvedValue(items);

      const handler = createCompletionHandler(mockClient as LSPClient);
      const result = await handler.getCompletion("file:///test.ts", {
        line: 0,
        character: 0,
      });

      expect(result).toEqual(items);
      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        "textDocument/completion",
        {
          textDocument: { uri: "file:///test.ts" },
          position: { line: 0, character: 0 },
        },
      );
    });

    it("should handle CompletionList response", async () => {
      const items: CompletionItem[] = [
        testHelpers.createMockCompletionItem({ label: "item1" }),
        testHelpers.createMockCompletionItem({ label: "item2" }),
      ];
      const completionList = testHelpers.createMockCompletionList(items);

      vi.mocked(mockClient.sendRequest!).mockResolvedValue(completionList);

      const handler = createCompletionHandler(mockClient as LSPClient);
      const result = await handler.getCompletion("file:///test.ts", {
        line: 0,
        character: 0,
      });

      expect(result).toEqual(items);
    });

    it("should handle null response", async () => {
      vi.mocked(mockClient.sendRequest!).mockResolvedValue(null);

      const handler = createCompletionHandler(mockClient as LSPClient);
      const result = await handler.getCompletion("file:///test.ts", {
        line: 0,
        character: 0,
      });

      expect(result).toEqual([]);
    });

    it("should resolve completion items", async () => {
      const item = testHelpers.createMockCompletionItem({ label: "test" });
      const resolvedItem = {
        ...item,
        detail: "Resolved detail",
        documentation: "Resolved documentation",
      };

      vi.mocked(mockClient.sendRequest!).mockResolvedValue(resolvedItem);

      const handler = createCompletionHandler(mockClient as LSPClient);
      const result = await handler.resolveCompletionItem(item);

      expect(result).toEqual(resolvedItem);
      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        "completionItem/resolve",
        item,
      );
    });

    it("should return original item if resolve fails", async () => {
      const item = testHelpers.createMockCompletionItem({ label: "test" });

      vi.mocked(mockClient.sendRequest!).mockRejectedValue(
        new Error("Resolve failed"),
      );

      const handler = createCompletionHandler(mockClient as LSPClient);
      const result = await handler.resolveCompletionItem(item);

      expect(result).toEqual(item);
    });
  });

  describe("AdvancedCompletionHandler", () => {
    it("should sort completions by sortText", async () => {
      const items: CompletionItem[] = [
        testHelpers.createMockCompletionItem({
          label: "item1",
          sortText: "b",
        }),
        testHelpers.createMockCompletionItem({
          label: "item2",
          sortText: "a",
        }),
        testHelpers.createMockCompletionItem({
          label: "item3",
          sortText: "c",
        }),
      ];

      vi.mocked(mockClient.sendRequest!).mockResolvedValue(items);

      const handler = createAdvancedCompletionHandler(mockClient as LSPClient);
      const result = await handler.getCompletionsWithImports(
        "file:///test.ts",
        { line: 0, character: 0 },
      );

      expect(result[0].label).toBe("item2"); // sortText: "a"
      expect(result[1].label).toBe("item1"); // sortText: "b"
      expect(result[2].label).toBe("item3"); // sortText: "c"
    });

    it("should prioritize preselected items", async () => {
      const items: CompletionItem[] = [
        testHelpers.createMockCompletionItem({
          label: "item1",
          preselect: false,
        }),
        testHelpers.createMockCompletionItem({
          label: "item2",
          preselect: true,
        }),
        testHelpers.createMockCompletionItem({
          label: "item3",
          preselect: false,
        }),
      ];

      vi.mocked(mockClient.sendRequest!).mockResolvedValue(items);

      const handler = createAdvancedCompletionHandler(mockClient as LSPClient);
      const result = await handler.getCompletionsWithImports(
        "file:///test.ts",
        { line: 0, character: 0 },
      );

      expect(result[0].label).toBe("item2"); // preselect: true
    });

    it("should resolve all items when resolveAll is true", async () => {
      const items: CompletionItem[] = [
        testHelpers.createMockCompletionItem({ label: "item1" }),
        testHelpers.createMockCompletionItem({ label: "item2" }),
      ];

      const resolvedItems = items.map((item) => ({
        ...item,
        detail: `Resolved ${item.label}`,
      }));

      vi.mocked(mockClient.sendRequest!)
        .mockResolvedValueOnce(items) // getCompletion
        .mockResolvedValueOnce(resolvedItems[0]) // resolve item1
        .mockResolvedValueOnce(resolvedItems[1]); // resolve item2

      const handler = createAdvancedCompletionHandler(mockClient as LSPClient);
      const result = await handler.getCompletionsWithImports(
        "file:///test.ts",
        { line: 0, character: 0 },
        { resolveAll: true },
      );

      expect(result[0].detail).toBe("Resolved item1");
      expect(result[1].detail).toBe("Resolved item2");
    });

    it("should filter auto-import items", async () => {
      const items: CompletionItem[] = [
        testHelpers.createMockCompletionItem({
          label: "normalItem",
        }),
        testHelpers.createMockCompletionItem({
          label: "importItem1",
          additionalTextEdits: [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
              newText: 'import { importItem1 } from "module";\n',
            },
          ],
        }),
        testHelpers.createMockCompletionItem({
          label: "importItem2",
          detail: "Auto-import from 'another-module'",
        }),
      ];

      vi.mocked(mockClient.sendRequest!).mockResolvedValue(items);

      const handler = createAdvancedCompletionHandler(mockClient as LSPClient);
      const result = await handler.getCompletionsWithImports(
        "file:///test.ts",
        { line: 0, character: 0 },
        { filterAutoImports: true },
      );

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("importItem1");
      expect(result[1].label).toBe("importItem2");
    });

    it("should respect maxItems limit", async () => {
      const items: CompletionItem[] = Array.from({ length: 50 }, (_, i) =>
        testHelpers.createMockCompletionItem({ label: `item${i}` }),
      );

      vi.mocked(mockClient.sendRequest!).mockResolvedValue(items);

      const handler = createAdvancedCompletionHandler(mockClient as LSPClient);
      const result = await handler.getCompletionsWithImports(
        "file:///test.ts",
        { line: 0, character: 0 },
        { maxItems: 10 },
      );

      expect(result).toHaveLength(10);
    });
  });
});

describe("Integration with real LSP servers", () => {
  // These tests will be implemented to test with actual typescript-language-server and tsgo
  describe.todo("typescript-language-server", () => {
    it("should handle completions from typescript-language-server");
    it("should resolve import completions");
    it("should handle incremental completions");
  });

  describe.todo("tsgo", () => {
    it("should handle completions from tsgo");
    it("should handle different response format");
    it("should work with tsgo-specific features");
  });
});
