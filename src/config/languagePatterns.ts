/**
 * Common language file patterns shared across presets and adapter defaults
 */

export interface LanguagePatterns {
  typescript: string[];
  javascript: string[];
  python: string[];
  rust: string[];
  go: string[];
  fsharp: string[];
  moonbit: string[];
}

export const LANGUAGE_PATTERNS: LanguagePatterns = {
  typescript: ["**/*.ts", "**/*.tsx"],
  javascript: ["**/*.js", "**/*.jsx", "**/*.mjs", "**/*.mts"],
  python: ["**/*.py", "**/*.pyi"],
  rust: ["**/*.rs"],
  go: ["**/*.go"],
  fsharp: ["**/*.fs", "**/*.fsx", "**/*.fsi"],
  moonbit: ["**/*.mbt", "**/*.mbti"],
};

/**
 * Combined TypeScript and JavaScript patterns for adapters that support both
 */
export const TS_JS_PATTERNS = [
  ...LANGUAGE_PATTERNS.typescript,
  ...LANGUAGE_PATTERNS.javascript,
];

/**
 * Get file patterns for a specific language
 */
export function getLanguagePatterns(
  language: keyof LanguagePatterns,
): string[] {
  return LANGUAGE_PATTERNS[language];
}

/**
 * Get combined TypeScript/JavaScript patterns
 */
export function getTsJsPatterns(): string[] {
  return TS_JS_PATTERNS;
}
