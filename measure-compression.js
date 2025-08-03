/**
 * Standalone script to measure token compression effect
 */

// import { SymbolIndex } from "./dist/lsmcp.js";
import { readFile } from "fs/promises";
import { glob } from "glob";

// Simple token counter
function countTokens(text) {
  const tokens = text
    .split(/[\s\n\r\t,.;:!?(){}\[\]"'`]+/)
    .filter((t) => t.length > 0);
  return tokens.length;
}

// Format symbols to compact representation
function formatSymbols(symbols, indent = 0) {
  const lines = [];
  for (const symbol of symbols) {
    const prefix = "  ".repeat(indent);
    lines.push(`${prefix}${symbol.name}:${symbol.kind}`);
    if (symbol.children) {
      lines.push(...formatSymbols(symbol.children, indent + 1));
    }
  }
  return lines;
}

async function main() {
  const pattern = "src/**/*.ts";
  const files = await glob(pattern, {
    ignore: ["**/node_modules/**", "**/dist/**", "**/*.test.ts"],
  });

  console.log(`Analyzing ${files.length} files...`);

  let totalFullTokens = 0;
  let totalSymbolTokens = 0;
  const results = [];

  for (const file of files.slice(0, 10)) {
    // Analyze first 10 files
    try {
      const content = await readFile(file, "utf-8");
      const fullTokens = countTokens(content);

      // Mock symbol extraction (in real implementation, use LSP)
      const symbolLines = [];

      // Extract class/interface/function declarations
      const classMatches = content.matchAll(
        /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g,
      );
      for (const match of classMatches) {
        symbolLines.push(`${match[1]}:5`); // 5 = Class
      }

      const interfaceMatches = content.matchAll(
        /(?:export\s+)?interface\s+(\w+)/g,
      );
      for (const match of interfaceMatches) {
        symbolLines.push(`${match[1]}:11`); // 11 = Interface
      }

      const functionMatches = content.matchAll(
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      );
      for (const match of functionMatches) {
        symbolLines.push(`${match[1]}:12`); // 12 = Function
      }

      const symbolSummary = symbolLines.join("\n");
      const symbolTokens = countTokens(symbolSummary);

      const compression = ((1 - symbolTokens / fullTokens) * 100).toFixed(1);

      results.push({
        file,
        fullTokens,
        symbolTokens,
        compression,
        lines: content.split("\n").length,
      });

      totalFullTokens += fullTokens;
      totalSymbolTokens += symbolTokens;
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }

  console.log("\nToken Compression Analysis");
  console.log("==========================");
  console.log(`Files analyzed: ${results.length}`);
  console.log(
    `Total tokens (full source): ${totalFullTokens.toLocaleString()}`,
  );
  console.log(
    `Total tokens (symbols only): ${totalSymbolTokens.toLocaleString()}`,
  );
  console.log(
    `Overall compression: ${((1 - totalSymbolTokens / totalFullTokens) * 100).toFixed(1)}%`,
  );

  console.log("\nTop compressed files:");
  results
    .sort((a, b) => parseFloat(b.compression) - parseFloat(a.compression))
    .slice(0, 5)
    .forEach((r) => {
      console.log(`  ${r.file}`);
      console.log(
        `    ${r.fullTokens} → ${r.symbolTokens} tokens (${r.compression}% reduction)`,
      );
    });
}

main().catch(console.error);
