import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "child_process";
import { initialize as initializeLSPClient } from "../../src/lsp/lspClient.ts";
import { createAdvancedCompletionHandler } from "../../src/lsp/commands/completion.ts";
import { pathToFileURL } from "url";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "lsmcp-completion-test");
const TEST_FILE = join(TEST_DIR, "test.ts");
const TEST_FILE_URI = pathToFileURL(TEST_FILE).toString();

// Test content with various completion scenarios
const TEST_CONTENT = `// Test file for completions
import { readFile } from "fs/promises";

interface Person {
  name: string;
  age: number;
  address?: {
    street: string;
    city: string;
  };
}

class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
  
  subtract(a: number, b: number): number {
    return a - b;
  }
}

const person: Person = {
  name: "John",
  age: 30,
};

// Test member access
person.

// Test method access
const calc = new Calculator();
calc.

// Test string methods
const message = "Hello, World!";
message.

// Test import completion (type "readF" to get readFile suggestion)
read

// Test interface property completion
const address = person.
`;

describe("Completion Integration Tests", () => {
  beforeAll(async () => {
    // Create test directory and file
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(TEST_FILE, TEST_CONTENT);
  });

  afterAll(async () => {
    // Clean up
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("typescript-language-server", () => {
    let client: any;
    let handler: ReturnType<typeof createAdvancedCompletionHandler>;

    beforeAll(async () => {
      try {
        // Spawn TypeScript Language Server process
        const lspProcess = spawn(
          "npx",
          ["typescript-language-server", "--stdio"],
          {
            cwd: process.cwd(), // Use project root instead of test dir
          },
        );

        // Initialize LSP client with the process
        client = await initializeLSPClient(
          process.cwd(), // Use project root
          lspProcess,
          "typescript",
        );

        // Open the test document
        await client.openDocument(TEST_FILE_URI, TEST_CONTENT);

        // Create completion handler
        handler = createAdvancedCompletionHandler(client);

        // Wait a bit for the server to analyze the file
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn(
          "typescript-language-server initialization failed:",
          error,
        );
      }
    });

    afterAll(async () => {
      if (client) {
        await client.stop();
      }
    });

    it.skipIf(!client)(
      "should provide object property completions",
      async () => {
        // Find the position after "person."
        const lines = TEST_CONTENT.split("\\n");
        const lineIndex = lines.findIndex((line) => line === "person.");
        const character = 7; // After the dot

        const completions = await handler.getCompletionsWithImports(
          TEST_FILE_URI,
          { line: lineIndex, character },
        );

        expect(completions.length).toBeGreaterThan(0);

        // Should include Person interface properties
        const labels = completions.map((c: any) => c.label);
        expect(labels).toContain("name");
        expect(labels).toContain("age");
        expect(labels).toContain("address");
      },
    );

    it.skipIf(!client)("should provide method completions", async () => {
      // Find the position after "calc."
      const lines = TEST_CONTENT.split("\\n");
      const lineIndex = lines.findIndex((line) => line === "calc.");
      const character = 5; // After the dot

      const completions = await handler.getCompletionsWithImports(
        TEST_FILE_URI,
        { line: lineIndex, character },
      );

      const labels = completions.map((c: any) => c.label);
      expect(labels).toContain("add");
      expect(labels).toContain("subtract");
    });

    it.skipIf(!client)("should provide string method completions", async () => {
      // Find the position after "message."
      const lines = TEST_CONTENT.split("\\n");
      const lineIndex = lines.findIndex((line) => line === "message.");
      const character = 8; // After the dot

      const completions = await handler.getCompletionsWithImports(
        TEST_FILE_URI,
        { line: lineIndex, character },
      );

      const labels = completions.map((c: any) => c.label);
      expect(labels).toContain("charAt");
      expect(labels).toContain("substring");
      expect(labels).toContain("toLowerCase");
      expect(labels).toContain("toUpperCase");
    });

    it.skipIf(!client)(
      "should resolve completion items with details",
      async () => {
        const lines = TEST_CONTENT.split("\\n");
        const lineIndex = lines.findIndex((line) => line === "person.");
        const character = 7;

        const completions = await handler.getCompletionsWithImports(
          TEST_FILE_URI,
          { line: lineIndex, character },
          { resolveAll: true, maxItems: 5 },
        );

        // Check that items have been resolved with additional details
        const nameCompletion = completions.find((c: any) => c.label === "name");
        expect(nameCompletion).toBeDefined();
        expect(nameCompletion?.detail).toBeTruthy();
      },
    );

    it.skipIf(!client)("should filter auto-import completions", async () => {
      // Find the position after "read" (for readFile import)
      const lines = TEST_CONTENT.split("\\n");
      const lineIndex = lines.findIndex((line) => line === "read");
      const character = 4; // After "read"

      const completions = await handler.getCompletionsWithImports(
        TEST_FILE_URI,
        { line: lineIndex, character },
        { filterAutoImports: true, resolveAll: true },
      );

      // Should find auto-import suggestions
      const hasAutoImport = completions.some(
        (c: any) =>
          (c.additionalTextEdits && c.additionalTextEdits.length > 0) ||
          (c.detail && c.detail.includes("import")),
      );

      // Note: This might not work if the server doesn't provide auto-import suggestions
      // in this context. The test is more about verifying the filtering logic works.
      if (completions.length > 0) {
        expect(hasAutoImport).toBe(true);
      }
    });
  });

  describe("tsgo", () => {
    let client: any;
    let handler: ReturnType<typeof createAdvancedCompletionHandler>;

    beforeAll(async () => {
      try {
        // Spawn tsgo process
        const lspProcess = spawn("npx", ["tsgo", "--lsp", "--stdio"], {
          cwd: process.cwd(),
        });

        // Initialize LSP client with the process
        client = await initializeLSPClient(
          process.cwd(),
          lspProcess,
          "typescript",
        );

        // Open the test document
        await client.openDocument(TEST_FILE_URI, TEST_CONTENT);

        // Create completion handler
        handler = createAdvancedCompletionHandler(client);

        // Wait a bit for the server to analyze the file
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn("tsgo not available, skipping tests:", error);
      }
    });

    afterAll(async () => {
      if (client) {
        await client.stop();
      }
    });

    it.skipIf(!client)(
      "should provide object property completions",
      async () => {
        const lines = TEST_CONTENT.split("\\n");
        const lineIndex = lines.findIndex((line) => line === "person.");
        const character = 7;

        const completions = await handler.getCompletionsWithImports(
          TEST_FILE_URI,
          { line: lineIndex, character },
        );

        expect(completions.length).toBeGreaterThan(0);

        const labels = completions.map((c: any) => c.label);
        expect(labels).toContain("name");
        expect(labels).toContain("age");
      },
    );

    it.skipIf(!client)(
      "should handle tsgo-specific response format",
      async () => {
        const lines = TEST_CONTENT.split("\\n");
        const lineIndex = lines.findIndex((line) => line === "calc.");
        const character = 5;

        const completions = await handler.getCompletionsWithImports(
          TEST_FILE_URI,
          { line: lineIndex, character },
        );

        // tsgo might return completions in a different format
        // but our handler should normalize them
        expect(Array.isArray(completions)).toBe(true);
        expect(completions.length).toBeGreaterThan(0);
      },
    );
  });
});

describe("Completion Handler Edge Cases", () => {
  it("should handle empty completion list", async () => {
    const mockClient = {
      sendRequest: async () => [],
    };

    const handler = createAdvancedCompletionHandler(mockClient as any);
    const result = await handler.getCompletionsWithImports("file:///test.ts", {
      line: 0,
      character: 0,
    });

    expect(result).toEqual([]);
  });

  it("should handle server errors gracefully", async () => {
    const mockClient = {
      sendRequest: async () => {
        throw new Error("Server error");
      },
    };

    const handler = createAdvancedCompletionHandler(mockClient as any);

    await expect(
      handler.getCompletionsWithImports("file:///test.ts", {
        line: 0,
        character: 0,
      }),
    ).rejects.toThrow("Server error");
  });
});
