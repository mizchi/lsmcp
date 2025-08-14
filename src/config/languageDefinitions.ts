/**
 * Centralized language file definitions for the LSMCP project.
 * This file contains all language-specific file patterns used throughout the codebase.
 */

export interface LanguageDefinition {
  name: string;
  extensions: string[];
  patterns: string[];
  preset?: string;
}

export const LANGUAGE_DEFINITIONS: Record<string, LanguageDefinition> = {
  typescript: {
    name: "TypeScript",
    extensions: [".ts", ".tsx", ".d.ts"],
    patterns: ["**/*.ts", "**/*.tsx", "**/*.d.ts"],
    preset: "typescript",
  },
  javascript: {
    name: "JavaScript",
    extensions: [".js", ".jsx", ".mjs", ".mts", ".cjs"],
    patterns: ["**/*.js", "**/*.jsx", "**/*.mjs", "**/*.mts", "**/*.cjs"],
    preset: "typescript",
  },
  python: {
    name: "Python",
    extensions: [".py", ".pyi"],
    patterns: ["**/*.py", "**/*.pyi"],
    preset: "pyright",
  },
  rust: {
    name: "Rust",
    extensions: [".rs"],
    patterns: ["**/*.rs"],
    preset: "rust-analyzer",
  },
  go: {
    name: "Go",
    extensions: [".go"],
    patterns: ["**/*.go"],
    preset: "gopls",
  },
  fsharp: {
    name: "F#",
    extensions: [".fs", ".fsi", ".fsx"],
    patterns: ["**/*.fs", "**/*.fsi", "**/*.fsx"],
    preset: "fsautocomplete",
  },
  moonbit: {
    name: "MoonBit",
    extensions: [".mbt", ".mbti"],
    patterns: ["**/*.mbt", "**/*.mbti"],
    preset: "moonbit",
  },
  gleam: {
    name: "Gleam",
    extensions: [".gleam"],
    patterns: ["**/*.gleam"],
    preset: "gleam",
  },
};

export const PRESET_LANGUAGE_PATTERNS: Record<string, string[]> = {
  tsgo: LANGUAGE_DEFINITIONS.typescript.patterns,
  typescript: [
    ...LANGUAGE_DEFINITIONS.typescript.patterns,
    ...LANGUAGE_DEFINITIONS.javascript.patterns,
  ],
  deno: LANGUAGE_DEFINITIONS.typescript.patterns,
  "typescript-language-server": [
    ...LANGUAGE_DEFINITIONS.typescript.patterns,
    ...LANGUAGE_DEFINITIONS.javascript.patterns,
  ],
  "rust-analyzer": LANGUAGE_DEFINITIONS.rust.patterns,
  pyright: LANGUAGE_DEFINITIONS.python.patterns,
  ruff: LANGUAGE_DEFINITIONS.python.patterns,
  gopls: LANGUAGE_DEFINITIONS.go.patterns,
  fsautocomplete: LANGUAGE_DEFINITIONS.fsharp.patterns,
  fsharp: LANGUAGE_DEFINITIONS.fsharp.patterns,
  moonbit: LANGUAGE_DEFINITIONS.moonbit.patterns,
  gleam: LANGUAGE_DEFINITIONS.gleam.patterns,
};

export function getLanguageFromExtension(
  extension: string,
): LanguageDefinition | null {
  for (const lang of Object.values(LANGUAGE_DEFINITIONS)) {
    if (lang.extensions.includes(extension)) {
      return lang;
    }
  }
  return null;
}

export function getLanguageFromFileName(
  fileName: string,
): LanguageDefinition | null {
  const ext = fileName.match(/\.[^.]+$/)?.[0];
  if (!ext) return null;
  return getLanguageFromExtension(ext);
}

export function getPatternsForPreset(preset: string): string[] {
  return PRESET_LANGUAGE_PATTERNS[preset] || ["**/*"];
}
