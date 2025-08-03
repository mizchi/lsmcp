/**
 * Test token compression effect of symbol indexing
 */

import { readFile } from "fs/promises";
import { glob } from "glob";

/**
 * Count tokens in a text (simple approximation)
 * GPT-like tokenizers average ~4 characters per token
 */
function countTokens(text: string): number {
  // Simple approximation: split by whitespace and punctuation
  const tokens = text
    .split(/[\s\n\r\t,.;:!?(){}\[\]"'`]+/)
    .filter((t) => t.length > 0);
  return tokens.length;
}

/**
 * Format symbol information in a compact way
 */
function formatSymbolSummary(symbols: any[]): string {
  const lines: string[] = [];

  const processSymbol = (symbol: any, indent = 0) => {
    const prefix = "  ".repeat(indent);
    lines.push(`${prefix}${symbol.name}:${symbol.kind}`);
    if (symbol.children) {
      for (const child of symbol.children) {
        processSymbol(child, indent + 1);
      }
    }
  };

  for (const symbol of symbols) {
    processSymbol(symbol);
  }

  return lines.join("\n");
}

/**
 * Compare token counts between full source and symbol summary
 */
export async function measureTokenCompression(
  filePath: string,
  symbols: any[],
) {
  // Read full source
  const fullSource = await readFile(filePath, "utf-8");
  const fullTokens = countTokens(fullSource);

  // Create symbol summary
  const symbolSummary = formatSymbolSummary(symbols);
  const summaryTokens = countTokens(symbolSummary);

  // Calculate compression ratio
  const compressionRatio = (1 - summaryTokens / fullTokens) * 100;

  return {
    filePath,
    fullSource: {
      characters: fullSource.length,
      lines: fullSource.split("\n").length,
      tokens: fullTokens,
    },
    symbolSummary: {
      characters: symbolSummary.length,
      lines: symbolSummary.split("\n").length,
      tokens: summaryTokens,
    },
    compressionRatio: compressionRatio.toFixed(2),
    summary: symbolSummary,
  };
}

/**
 * Analyze multiple files
 */
export async function analyzeTokenCompression(
  pattern: string,
  rootPath: string,
  getSymbols: (filePath: string) => Promise<any[]>,
) {
  const files = await glob(pattern, {
    cwd: rootPath,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  });

  const results = [];
  let totalFullTokens = 0;
  let totalSummaryTokens = 0;

  for (const file of files) {
    try {
      const symbols = await getSymbols(file);
      if (symbols && symbols.length > 0) {
        const result = await measureTokenCompression(file, symbols);
        results.push(result);
        totalFullTokens += result.fullSource.tokens;
        totalSummaryTokens += result.symbolSummary.tokens;
      }
    } catch (error) {
      console.error(`Error analyzing ${file}:`, error);
    }
  }

  const overallCompression = (1 - totalSummaryTokens / totalFullTokens) * 100;

  return {
    files: results,
    summary: {
      totalFiles: results.length,
      totalFullTokens,
      totalSummaryTokens,
      overallCompression: overallCompression.toFixed(2),
    },
  };
}
