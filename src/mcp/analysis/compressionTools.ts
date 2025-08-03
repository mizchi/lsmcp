/**
 * Tools for measuring token compression effect
 */

import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import {
  getOrCreateIndex,
  indexFiles,
} from "../../indexer/mcp/IndexerAdapter.ts";
import { analyzeTokenCompression } from "../../indexer/tests/tokenCompressionTest.ts";
import { glob } from "glob";

const measureCompressionSchema = z.object({
  pattern: z.string().describe("Glob pattern for files to analyze"),
  root: z.string().describe("Root directory").optional(),
  indexFirst: z
    .boolean()
    .default(true)
    .describe("Index files before measuring"),
});

export const measureCompressionTool: ToolDef<typeof measureCompressionSchema> =
  {
    name: "measure_token_compression",
    description: "Measure token compression effect of symbol indexing",
    schema: measureCompressionSchema,
    execute: async ({ pattern, root, indexFirst }) => {
      const rootPath = root || process.cwd();

      // Index files if requested
      if (indexFirst) {
        const files = await glob(pattern, {
          cwd: rootPath,
          ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
        });

        if (files.length === 0) {
          return "No files found matching pattern";
        }

        const indexResult = await indexFiles(rootPath, files);
        if (!indexResult.success) {
          return `Failed to index files: ${indexResult.errors.map((e) => e.error).join(", ")}`;
        }
      }

      // Get index
      const index = getOrCreateIndex(rootPath);
      if (!index) {
        return "Failed to get symbol index";
      }

      // Analyze compression
      const result = await analyzeTokenCompression(
        pattern,
        rootPath,
        async (filePath) => {
          const symbols = index.querySymbols({ file: filePath });
          // Convert to hierarchical structure
          const rootSymbols = symbols.filter((s) => !s.containerName);
          return rootSymbols;
        },
      );

      // Format results
      let output = `Token Compression Analysis
==========================

Overall Results:
- Files analyzed: ${result.summary.totalFiles}
- Total tokens (full source): ${result.summary.totalFullTokens}
- Total tokens (symbol summary): ${result.summary.totalSummaryTokens}
- Overall compression: ${result.summary.overallCompression}%

Per-file Results:
`;

      for (const file of result.files.slice(0, 10)) {
        output += `
${file.filePath}:
  Full source: ${file.fullSource.tokens} tokens (${file.fullSource.lines} lines)
  Symbol summary: ${file.symbolSummary.tokens} tokens (${file.symbolSummary.lines} lines)
  Compression: ${file.compressionRatio}%
`;
      }

      if (result.files.length > 10) {
        output += `\n... and ${result.files.length - 10} more files`;
      }

      // Show example of compressed output
      if (result.files.length > 0) {
        const example = result.files[0];
        output += `

Example Symbol Summary (${example.filePath}):
----------------------------------------
${example.summary}
`;
      }

      return output;
    },
  };

export const compressionTools = [measureCompressionTool];
