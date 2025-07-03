import { z } from "zod";
import { err, ok, type Result } from "neverthrow";
import { readFileSync } from "fs";
import path from "path";
import { getActiveClient } from "../lspClient.ts";
import type { ToolDef } from "../../mcp/utils/mcpHelpers.ts";
import { debug } from "../../mcp/utils/mcpHelpers.ts";
import { readFileWithMetadata } from "../../core/io/fileOperations.ts";
import { validateLineAndSymbol } from "../../core/pure/validation.ts";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbolName: z.string().describe("Name of the symbol to get definitions for"),
  before: z
    .number()
    .optional()
    .describe("Number of lines to show before the definition"),
  after: z
    .number()
    .optional()
    .describe("Number of lines to show after the definition"),
});

type GetDefinitionsRequest = z.infer<typeof schema>;

interface Definition {
  filePath: string;
  line: number;
  column: number;
  symbolName: string;
  preview: string;
}

interface GetDefinitionsSuccess {
  message: string;
  definitions: Definition[];
}

// Import Location and LocationLink types from vscode-languageserver-types via lspTypes
import type { Location, LocationLink } from "../lspTypes.ts";

/**
 * Gets definitions for a TypeScript symbol using LSP
 */
async function getDefinitionsWithLSP(
  request: GetDefinitionsRequest,
): Promise<Result<GetDefinitionsSuccess, string>> {
  try {
    const client = getActiveClient();

    // Read file content with metadata
    const { fileContent, fileUri } = readFileWithMetadata(
      request.root,
      request.filePath,
    );

    // Validate line and symbol
    const { lineIndex: targetLine, symbolIndex: symbolPosition } =
      validateLineAndSymbol(
        fileContent,
        request.line,
        request.symbolName,
        request.filePath,
      );

    // Open document in LSP
    client.openDocument(fileUri, fileContent);

    // Give LSP server time to process the document
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));

    debug("[lspGetDefinitions] Getting definition for:", {
      fileUri,
      position: { line: targetLine, character: symbolPosition },
      symbolName: request.symbolName,
    });

    // Get definition
    const result = await client.getDefinition(fileUri, {
      line: targetLine,
      character: symbolPosition,
    });

    // Normalize result to array
    const locations = result ? (Array.isArray(result) ? result : [result]) : [];

    debug(
      "[lspGetDefinitions] Raw LSP result:",
      JSON.stringify(result, null, 2),
    );
    debug(
      "[lspGetDefinitions] Normalized locations:",
      JSON.stringify(locations, null, 2),
    );

    // Convert LSP locations to our Definition format
    const definitions: Definition[] = [];
    const contextBefore = request.before || 2;
    const contextAfter = request.after || 2;

    if (locations.length === 0) {
      debug("[lspGetDefinitions] No definitions found");
      return ok({
        message: `No definitions found for "${request.symbolName}"`,
        definitions: [],
      });
    }

    for (const loc of locations) {
      // Handle LocationLink vs Location
      let location: Location;
      if ("targetUri" in loc) {
        // This is a LocationLink
        const link = loc as LocationLink;
        location = {
          uri: link.targetUri,
          range: link.targetSelectionRange || link.targetRange,
        };
      } else {
        // This is already a Location
        location = loc as Location;
      }

      // Handle different URI formats
      let defPath = "";
      if (location.uri) {
        debug("[lspGetDefinitions] Processing location URI:", location.uri);
        // Remove file:// prefix and handle both file:// and file:/// formats
        defPath = location.uri.replace(/^file:\/\/\/?/, "/");
        // For Windows paths, handle file:///C:/ format
        if (defPath.match(/^\/[A-Za-z]:\//)) {
          defPath = defPath.substring(1);
        }
        debug("[lspGetDefinitions] Resolved path:", defPath);
      } else {
        debug("[lspGetDefinitions] Location has no URI:", location);
        // Skip if no URI
        continue;
      }

      // Try to read the definition file
      let defContent: string;
      let defLines: string[];
      try {
        defContent = readFileSync(defPath, "utf-8");
        defLines = defContent.split("\n");
      } catch (e) {
        // Skip if file cannot be read
        continue;
      }

      // Get the text at the definition location
      const startLine = location.range.start.line;
      const startCol = location.range.start.character;
      const defLineText = defLines[startLine] || "";

      // Try to extract the symbol text from the line
      let symbolName = "";

      // Simple heuristic to find identifier boundaries
      const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
      let match;
      while ((match = identifierPattern.exec(defLineText)) !== null) {
        if (
          match.index <= startCol &&
          startCol < match.index + match[0].length
        ) {
          symbolName = match[0];
          break;
        }
      }

      // If no symbol found, use the requested symbol name
      if (!symbolName) {
        symbolName = request.symbolName;
      }

      // Create preview with context
      const previewLines: string[] = [];
      for (
        let i = Math.max(0, startLine - contextBefore);
        i <= Math.min(defLines.length - 1, startLine + contextAfter);
        i++
      ) {
        previewLines.push(`${i + 1}: ${defLines[i]}`);
      }
      const preview = previewLines.join("\n");

      definitions.push({
        filePath: path.relative(request.root, defPath),
        line: startLine + 1, // Convert to 1-based
        column: startCol + 1, // Convert to 1-based
        symbolName,
        preview,
      });
    }

    return ok({
      message: `Found ${definitions.length} definition${
        definitions.length === 1 ? "" : "s"
      } for "${request.symbolName}"`,
      definitions,
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

export const lspGetDefinitionsTool: ToolDef<typeof schema> = {
  name: "get_definitions",
  description: "Get the definition(s) of a symbol using LSP",
  schema,
  execute: async (args: z.infer<typeof schema>) => {
    const result = await getDefinitionsWithLSP(args);
    if (result.isOk()) {
      const messages = [result.value.message];

      if (result.value.definitions.length > 0) {
        for (const def of result.value.definitions) {
          messages.push(
            `\n${def.filePath}:${def.line}:${def.column} - ${def.symbolName}\n${def.preview}`,
          );
        }
      }

      return messages.join("\n\n");
    } else {
      throw new Error(result.error);
    }
  },
};

if (import.meta.vitest) {
  const { describe, it, expect, beforeAll, afterAll } = import.meta.vitest;
  const { setupLSPForTest, teardownLSPForTest } = await import(
    "../testHelpers.ts"
  );
  const { default: path } = await import("path");

  describe("lspGetDefinitionsTool", () => {
    const root = path.resolve(import.meta.dirname, "../../..");

    beforeAll(async () => {
      await setupLSPForTest(root);
    });

    afterAll(async () => {
      await teardownLSPForTest();
    });

    it("should have correct tool definition", () => {
      expect(lspGetDefinitionsTool.name).toBe("get_definitions");
      expect(lspGetDefinitionsTool.description).toContain("definition");
      expect(lspGetDefinitionsTool.schema).toBeDefined();
    });

    it.skip("should find definition of an exported symbol", async () => {
      // Using the example connected.ts file which imports from "./scratch"
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "examples/typescript/connected.ts",
        line: 1, // export line
        symbolName: "x",
      });

      expect(result).toContain("Found");
      expect(result).toContain("definition");
    });

    it.skip("should find definition of a type in the same project", async () => {
      // The types.ts file has Value type used in getValue function
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        line: 10, // getValue function that returns Value type
        symbolName: "Value",
      });

      expect(result).toContain("Found");
    });

    it.skip("should handle string line matching", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        line: "ValueWithOptional",
        symbolName: "ValueWithOptional",
      });

      expect(result).toContain("ValueWithOptional");
    });

    it("should handle symbol not found on line", async () => {
      await expect(
        lspGetDefinitionsTool.execute({
          root,
          filePath: "examples/typescript/types.ts",
          line: 1,
          symbolName: "nonexistent",
        }),
      ).rejects.toThrow('Symbol "nonexistent" not found on line');
    });

    it("should handle line not found", async () => {
      await expect(
        lspGetDefinitionsTool.execute({
          root,
          filePath: "examples/typescript/types.ts",
          line: "nonexistent line",
          symbolName: "Value",
        }),
      ).rejects.toThrow('Line containing "nonexistent line" not found');
    });

    it("should handle file not found", async () => {
      await expect(
        lspGetDefinitionsTool.execute({
          root,
          filePath: "nonexistent.ts",
          line: 1,
          symbolName: "test",
        }),
      ).rejects.toThrow();
    });

    it.skip("should handle no definition found for built-in symbols", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "examples/typescript/types.ts",
        line: 11, // The return statement line
        symbolName: "v",
        before: 2,
        after: 2,
      });

      // Local variable might have definition or might not, depending on LSP
      expect(result).toContain("Found");
      expect(result).toContain("definition");
    });
  });
}
