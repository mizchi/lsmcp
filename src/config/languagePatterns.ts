/**
 * Common language file patterns shared across presets and adapter defaults
 * @deprecated Use languageDefinitions.ts instead for centralized language configuration
 */

import { LANGUAGE_DEFINITIONS } from "./languageDefinitions.ts";

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
  typescript: LANGUAGE_DEFINITIONS.typescript.patterns,
  javascript: LANGUAGE_DEFINITIONS.javascript.patterns,
  python: LANGUAGE_DEFINITIONS.python.patterns,
  rust: LANGUAGE_DEFINITIONS.rust.patterns,
  go: LANGUAGE_DEFINITIONS.go.patterns,
  fsharp: LANGUAGE_DEFINITIONS.fsharp.patterns,
  moonbit: LANGUAGE_DEFINITIONS.moonbit.patterns,
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
