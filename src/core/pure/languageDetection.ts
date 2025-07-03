import { basename, extname } from "path";
import * as languages from "linguist-languages";

interface LanguageData {
  name: string;
  extensions?: string[];
  filenames?: string[];
  type?: string;
}

/**
 * Get language ID from file path using linguist-languages
 * @param filePath The file path to analyze
 * @returns The language ID or null if not found
 */
export function getLanguageIdFromPath(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  const filename = basename(filePath);

  // Find all languages that match the extension or filename
  const matches = Object.entries(languages as Record<string, LanguageData>)
    .filter(([, langData]) => {
      // Match by extension
      if (ext && langData.extensions && langData.extensions.includes(ext)) {
        return true;
      }
      // Match by filename
      if (langData.filenames && langData.filenames.includes(filename)) {
        return true;
      }
      return false;
    })
    .map(([, langData]) => langData);

  if (matches.length === 0) {
    return null;
  }

  // If only one match, return it
  if (matches.length === 1) {
    return matches[0].name.toLowerCase();
  }

  // Special cases for common extensions that have ambiguous matches
  if (ext === ".md") {
    const markdown = matches.find(
      (lang) => lang.name.toLowerCase() === "markdown",
    );
    if (markdown) return markdown.name.toLowerCase();
  }
  if (ext === ".html") {
    const html = matches.find((lang) => lang.name.toLowerCase() === "html");
    if (html) return html.name.toLowerCase();
  }
  if (ext === ".tsx") {
    return "typescriptreact";
  }

  // Multiple matches - prioritize by type and popularity
  // Prefer programming languages over data/markup/prose
  const programmingLangs = matches.filter(
    (lang) => lang.type === "programming",
  );
  if (programmingLangs.length === 1) {
    return programmingLangs[0].name.toLowerCase();
  }
  if (programmingLangs.length > 1) {
    // For multiple programming languages, use specific preferences
    const preferred = programmingLangs.find((lang) => {
      const name = lang.name.toLowerCase();
      // Prefer well-known languages for common extensions
      if (ext === ".rs") return name === "rust";
      return false;
    });
    if (preferred) {
      return preferred.name.toLowerCase();
    }
    // Fall back to first programming language
    return programmingLangs[0].name.toLowerCase();
  }

  // No programming languages, prefer prose over markup over data
  const proseLangs = matches.filter((lang) => lang.type === "prose");
  if (proseLangs.length > 0) {
    // For .md files, prefer Markdown over other prose languages
    if (ext === ".md") {
      const markdown = proseLangs.find(
        (lang) => lang.name.toLowerCase() === "markdown",
      );
      if (markdown) return markdown.name.toLowerCase();
    }
    return proseLangs[0].name.toLowerCase();
  }

  const markupLangs = matches.filter((lang) => lang.type === "markup");
  if (markupLangs.length > 0) {
    return markupLangs[0].name.toLowerCase();
  }

  // For data languages, prefer well-known ones
  const dataLangs = matches.filter((lang) => lang.type === "data");
  if (dataLangs.length > 0) {
    if (ext === ".yaml" || ext === ".yml") {
      const yaml = dataLangs.find((lang) => lang.name.toLowerCase() === "yaml");
      if (yaml) return yaml.name.toLowerCase();
    }
    return dataLangs[0].name.toLowerCase();
  }

  // Fall back to first match
  return matches[0].name.toLowerCase();
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("getLanguageIdFromPath", () => {
    it("should detect common programming languages", () => {
      expect(getLanguageIdFromPath("index.ts")).toBe("typescript");
      expect(getLanguageIdFromPath("main.js")).toBe("javascript");
      expect(getLanguageIdFromPath("script.py")).toBe("python");
      expect(getLanguageIdFromPath("main.go")).toBe("go");
      expect(getLanguageIdFromPath("lib.rs")).toBe("rust");
      expect(getLanguageIdFromPath("Main.java")).toBe("java");
      expect(getLanguageIdFromPath("test.c")).toBe("c");
      expect(getLanguageIdFromPath("main.cpp")).toBe("c++");
    });

    it("should detect markup and data languages", () => {
      expect(getLanguageIdFromPath("index.html")).toBe("html");
      expect(getLanguageIdFromPath("style.css")).toBe("css");
      expect(getLanguageIdFromPath("data.json")).toBe("json");
      expect(getLanguageIdFromPath("config.yaml")).toBe("yaml");
      expect(getLanguageIdFromPath("config.yml")).toBe("yaml");
      expect(getLanguageIdFromPath("data.xml")).toBe("xml");
    });

    it("should handle special cases correctly", () => {
      expect(getLanguageIdFromPath("README.md")).toBe("markdown");
      expect(getLanguageIdFromPath("test.mbt")).toBe("moonbit");
      expect(getLanguageIdFromPath("component.vue")).toBe("vue");
      expect(getLanguageIdFromPath("script.sh")).toBe("shell");
    });

    it("should detect languages by filename", () => {
      expect(getLanguageIdFromPath("Dockerfile")).toBe("dockerfile");
      expect(getLanguageIdFromPath("makefile")).toBe("makefile");
      expect(getLanguageIdFromPath("Makefile")).toBe("makefile");
    });

    it("should return null for unknown extensions", () => {
      expect(getLanguageIdFromPath("unknown.xyz")).toBeNull();
      expect(getLanguageIdFromPath("noextension")).toBeNull();
    });

    it("should handle paths with directories", () => {
      expect(getLanguageIdFromPath("/path/to/index.ts")).toBe("typescript");
      expect(getLanguageIdFromPath("src/components/Button.tsx")).toBe(
        "typescriptreact",
      );
      expect(getLanguageIdFromPath("/app/Dockerfile")).toBe("dockerfile");
    });
  });
}
