import { minimatch } from "minimatch";

/**
 * Parse file patterns string, handling both comma-separated patterns and brace expansion
 */
export function parseFilePatterns(patternsString: string): string[] {
  const patterns: string[] = [];

  // Split by comma, but need to handle commas inside braces
  const parts = splitByCommaOutsideBraces(patternsString);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check if pattern contains brace expansion
    if (trimmed.includes("{") && trimmed.includes("}")) {
      // Use minimatch's brace expansion
      const expanded = minimatch.braceExpand(trimmed);
      patterns.push(...expanded);
    } else {
      patterns.push(trimmed);
    }
  }

  // Remove duplicates and return
  return [...new Set(patterns)];
}

/**
 * Split string by commas, but ignore commas inside braces
 */
function splitByCommaOutsideBraces(str: string): string[] {
  const result: string[] = [];
  let current = "";
  let braceDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === "{") {
      braceDepth++;
      current += char;
    } else if (char === "}") {
      braceDepth--;
      current += char;
    } else if (char === "," && braceDepth === 0) {
      // This is a separator comma
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Don't forget the last part
  if (current) {
    result.push(current);
  }

  return result;
}
