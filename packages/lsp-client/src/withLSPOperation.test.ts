import { describe, it, expect, afterEach } from "vitest";
import { withLSPOperation, ensureLSPClient } from "./client/lspOperations.ts";
import type { LSPClient } from "./lspTypes.ts";
import { setActiveClient } from "./globalClientManager.ts";

describe("lsp-client: withLSPOperation", () => {
  afterEach(() => {
    // Clean up after each test
    setActiveClient(null);
  });

  it("should open document and execute operation with provided client", async () => {
    const openCalls: Array<{ uri: string; text: string; languageId?: string }> =
      [];

    const mockClient: LSPClient = {
      languageId: "typescript",
      // minimal implementations for the parts we use
      fileSystemApi: {} as any,
      start: async () => {},
      stop: async () => {},
      openDocument: (uri: string, text: string, languageId?: string) => {
        openCalls.push({ uri, text, languageId });
      },
      closeDocument: () => {},
      updateDocument: () => {},
      isDocumentOpen: () => true,
      findReferences: async () => [],
      getDefinition: async () => [] as any,
      getHover: async () => null,
      getDiagnostics: () => [],
      getDocumentSymbols: async () => [],
      getWorkspaceSymbols: async () => [],
      getCompletion: async () => [],
      resolveCompletionItem: async (i) => i,
      getSignatureHelp: async () => null,
      getCodeActions: async () => [],
      formatDocument: async () => [],
      formatRange: async () => [],
      prepareRename: async () => null,
      rename: async () => null,
      applyEdit: async () => ({ applied: true }),
      sendRequest: async () => ({}) as any,
      on: () => {},
      emit: () => true,
      waitForDiagnostics: async () => [],
      getDiagnosticSupport: () => ({
        pushDiagnostics: true,
        pullDiagnostics: false,
      }),
      getServerCapabilities: () => undefined,
    };

    const fileUri = "file:///tmp/example.ts";
    const fileContent = "const x: number = 1;";

    // Set the mock client as active
    setActiveClient(mockClient);

    const result = await withLSPOperation({
      fileUri,
      fileContent,
      languageId: "typescript",
      waitTime: 0,
      timeout: 1000,
      operation: async (client) => {
        expect(client).toBe(mockClient);
        return 42;
      },
      errorContext: { operation: "unit_test" },
    });

    expect(result).toBe(42);
    expect(openCalls.length).toBe(1);
    expect(openCalls[0]?.uri).toBe(fileUri);
    expect(openCalls[0]?.text).toBe(fileContent);
    expect(openCalls[0]?.languageId).toBe("typescript");
  });

  it("ensureLSPClient should throw when no active client", () => {
    expect(() => ensureLSPClient("typescript")).toThrow();
  });
});
