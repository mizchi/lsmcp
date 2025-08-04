import { z } from "zod";
import { err, ok, type Result } from "neverthrow";
import { createLSPTool } from "../../core/io/toolFactory.ts";
import { withLSPOperation } from "../../core/io/lspOperations.ts";
import { resolveFileAndSymbol } from "../../core/io/fileSymbolResolver.ts";
import { getLanguageIdFromPath } from "../../core/pure/languageDetection.ts";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line")
    .optional(),
  character: z
    .number()
    .describe("Character position in the line (0-based)")
    .optional(),
  target: z
    .string()
    .describe("Text to find and get hover information for")
    .optional(),
});

type GetHoverRequest = z.infer<typeof schema>;

/**
 * LSP Hover response types
 */
interface MarkupContent {
  kind: "plaintext" | "markdown";
  value: string;
}

type MarkedString = string | { language: string; value: string };

interface HoverResult {
  contents: MarkedString | MarkedString[] | MarkupContent;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface GetHoverSuccess {
  message: string;
  hover: {
    contents: string;
    range?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  } | null;
}

/**
 * Format hover result into GetHoverSuccess
 */
function formatHoverResult(
  result: HoverResult | null,
  request: GetHoverRequest,
  targetLine: number,
  symbolPosition: number,
): Result<GetHoverSuccess, string> {
  if (!result) {
    return ok({
      message: `No hover information available${
        request.target ? ` for "${request.target}"` : ""
      } at ${request.filePath}:${targetLine + 1}:${symbolPosition + 1}`,
      hover: null,
    });
  }

  // Format hover contents
  const formattedContents = formatHoverContents(result.contents);

  // Format range - if not available, specify all lines
  let range;
  if (result.range) {
    range = {
      start: {
        line: result.range.start.line + 1,
        character: result.range.start.character + 1,
      },
      end: {
        line: result.range.end.line + 1,
        character: result.range.end.character + 1,
      },
    };
  } else {
    // If range is null, specify all lines
    const resolution = resolveFileAndSymbol({
      root: request.root,
      filePath: request.filePath,
    });
    const lines = resolution.lines;
    range = {
      start: {
        line: 1,
        character: 1,
      },
      end: {
        line: lines.length,
        character: lines[lines.length - 1]?.length || 0,
      },
    };
  }

  return ok({
    message: `Hover information for ${
      request.target ? `"${request.target}" at ` : ""
    }${request.filePath}:${targetLine + 1}:${symbolPosition + 1}`,
    hover: {
      contents: formattedContents,
      range,
    },
  });
}

/**
 * Gets hover information for a TypeScript symbol using LSP
 */
async function getHover(
  request: GetHoverRequest,
): Promise<Result<GetHoverSuccess, string>> {
  try {
    // Resolve file and position
    let resolution;
    let targetLine: number;
    let symbolPosition: number;

    if (request.line === undefined && request.target) {
      // Find target without line
      resolution = resolveFileAndSymbol({
        root: request.root,
        filePath: request.filePath,
        target: request.target,
      });
      targetLine = resolution.lineIndex;
      symbolPosition = resolution.symbolIndex;
    } else if (request.line !== undefined) {
      if (request.character !== undefined) {
        // Use provided character position
        resolution = resolveFileAndSymbol({
          root: request.root,
          filePath: request.filePath,
          line: request.line,
        });
        targetLine = resolution.lineIndex;
        symbolPosition = request.character;
      } else if (request.target) {
        // Find symbol in line
        resolution = resolveFileAndSymbol({
          root: request.root,
          filePath: request.filePath,
          line: request.line,
          symbolName: request.target,
        });
        targetLine = resolution.lineIndex;
        symbolPosition = resolution.symbolIndex;
      } else {
        // Default to beginning of line
        resolution = resolveFileAndSymbol({
          root: request.root,
          filePath: request.filePath,
          line: request.line,
        });
        targetLine = resolution.lineIndex;
        symbolPosition = 0;
      }
    } else {
      // No line or target provided
      return err("Either line or target must be provided");
    }

    const { fileUri, fileContent } = resolution;

    // Get language ID from file extension
    const languageId = getLanguageIdFromPath(request.filePath);

    // Get hover info using LSP operation wrapper
    const result = await withLSPOperation({
      fileUri,
      fileContent,
      languageId: languageId || undefined,
      timeout: 5000, // 5 second timeout for hover operations
      operation: async (client) => {
        return (await client.getHover(fileUri, {
          line: targetLine,
          character: symbolPosition,
        })) as HoverResult | null;
      },
      errorContext: {
        operation: "get_hover",
        filePath: request.filePath,
        symbolName: request.target,
        line: request.line,
      },
    });

    return formatHoverResult(result, request, targetLine, symbolPosition);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Formats hover contents from various LSP formats to a string
 */
function formatHoverContents(
  contents: MarkedString | MarkedString[] | MarkupContent,
): string {
  if (typeof contents === "string") {
    return contents;
  } else if (Array.isArray(contents)) {
    return contents
      .map((content: MarkedString) => {
        if (typeof content === "string") {
          return content;
        } else {
          return content.value;
        }
      })
      .join("\n");
  } else if (typeof contents === "object" && contents && "value" in contents) {
    return (contents as MarkupContent).value;
  }
  return "";
}

export const lspGetHoverTool = createLSPTool({
  name: "get_hover",
  description:
    "Get hover information (type signature, documentation) for a symbol using LSP",
  schema,
  language: "lsp",
  handler: getHover,
  formatSuccess: (result) => {
    const messages = [result.message];
    if (result.hover) {
      messages.push(result.hover.contents);
    }
    return messages.join("\n\n");
  },
});

if (import.meta.vitest) {
  const { describe, it, expect, beforeAll, afterAll } = import.meta.vitest;
  const { setupLSPForTest, teardownLSPForTest } = await import(
    "../testHelpers.ts"
  );
  const { default: path } = await import("path");

  describe("lspGetHoverTool", () => {
    const root = path.resolve(import.meta.dirname, "../../..");

    beforeAll(async () => {
      await setupLSPForTest(root);
    });

    afterAll(async () => {
      await teardownLSPForTest();
    });

    it("should have correct tool definition", () => {
      expect(lspGetHoverTool.name).toBe("get_hover");
      expect(lspGetHoverTool.description).toContain("hover information");
      expect(lspGetHoverTool.schema.shape).toBeDefined();
      expect(lspGetHoverTool.schema.shape.root).toBeDefined();
      expect(lspGetHoverTool.schema.shape.filePath).toBeDefined();
      expect(lspGetHoverTool.schema.shape.line).toBeDefined();
      expect(lspGetHoverTool.schema.shape.target).toBeDefined();
    });

    it("should get hover information for a type", async () => {
      const result = await lspGetHoverTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        line: 1,
        target: "Value",
      });

      expect(result).toContain('Hover information for "Value"');
      expect(result).toContain("type Value");
    });

    it("should get hover information using line string match", async () => {
      const result = await lspGetHoverTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        line: "ValueWithOptional",
        target: "ValueWithOptional",
      });

      expect(result).toContain("type ValueWithOptional");
      expect(result).toContain("o?: string");
    });

    it("should get hover information for a function", async () => {
      const result = await lspGetHoverTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        line: 10,
        target: "getValue",
      });

      expect(result).toContain("function getValue");
      expect(result).toContain("Value");
    });

    it("should handle no hover information gracefully", async () => {
      await expect(
        lspGetHoverTool.execute({
          root,
          filePath: "examples/typescript/types.ts",
          line: 3, // Empty line
          target: "v",
        }),
      ).rejects.toThrow('Symbol "v" not found');
    });

    it("should handle non-existent symbol error", async () => {
      await expect(
        lspGetHoverTool.execute({
          root,
          filePath: "examples/typescript/types.ts",
          line: 1,
          target: "NonExistentSymbol",
        }),
      ).rejects.toThrow('Symbol "NonExistentSymbol" not found');
    });

    it("should handle non-existent file error", async () => {
      await expect(
        lspGetHoverTool.execute({
          root,
          filePath: "examples/typescript/does-not-exist.ts",
          line: 1,
          target: "something",
        }),
      ).rejects.toThrow("File not found");
    });

    it("should handle line string not found error", async () => {
      await expect(
        lspGetHoverTool.execute({
          root,
          filePath: "examples/typescript/types.ts",
          line: "NonExistentLine",
          target: "something",
        }),
      ).rejects.toThrow('Line containing "NonExistentLine" not found');
    });

    it("should get hover information without line specified", async () => {
      const result = await lspGetHoverTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        target: "Value",
      });

      expect(result).toContain('Hover information for "Value"');
      expect(result).toContain("type Value");
    });
  });

  // @typescript/native-preview
  describe("lspGetHoverTool with fresh LSP instance", () => {
    const root = path.resolve(import.meta.dirname, "../../..");

    beforeAll(async () => {
      await setupLSPForTest(root);
    });

    afterAll(async () => {
      await teardownLSPForTest();
    });

    it("should get hover for property in object type", async () => {
      const result = await lspGetHoverTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        line: 2,
        target: "v",
      });

      expect(result).toContain("(property) v: string");
    });

    it("should get hover for optional property", async () => {
      const result = await lspGetHoverTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        line: 7,
        target: "o",
      });

      expect(result).toContain("(property) o?: string");
    });

    it("should get hover for return statement", async () => {
      const result = await lspGetHoverTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        line: 11,
        target: "return",
      });

      expect(result).toContain("return");
    });

    it("should find first occurrence when target appears multiple times", async () => {
      const result = await lspGetHoverTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        target: "string",
      });

      // Should find the first "string" in the file
      expect(result).toContain("string");
    });

    it("should handle complex target search without line", async () => {
      const result = await lspGetHoverTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        target: "getValue",
      });

      expect(result).toContain("function getValue(): Value");
    });

    it("should return hover with range information", async () => {
      const result = await lspGetHoverTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        line: 5,
        target: "ValueWithOptional",
      });

      // The result should contain hover information
      expect(result).toBeTruthy();
      expect(result).toContain("Hover information");
      expect(result).toContain("ValueWithOptional");
    });
  });
}
