import { describe, it, expect } from "vitest";
import { getSerenityTools, getSerenityToolsList } from "./index.ts";

describe("Configurable Language Features", () => {
  describe("getSerenityTools", () => {
    it("should return only core tools when no config provided", () => {
      const tools = getSerenityTools();

      // Core tools should be present
      expect(tools.replaceSymbolBody).toBeDefined();
      expect(tools.insertBeforeSymbol).toBeDefined();
      expect(tools.insertAfterSymbol).toBeDefined();
      expect(tools.replaceRegex).toBeDefined();
      expect(tools.listMemories).toBeDefined();
      expect(tools.readMemory).toBeDefined();
      expect(tools.writeMemory).toBeDefined();
      expect(tools.deleteMemory).toBeDefined();
      expect(tools.listDir).toBeDefined();
      expect(tools.findFile).toBeDefined();
      expect(tools.searchForPattern).toBeDefined();
      expect(tools.getSymbolsOverview).toBeDefined();
      // querySymbols removed - functionality now in search_symbols tool

      // TypeScript tools should NOT be present
      expect(tools.indexExternalLibraries).toBeUndefined();
      expect(tools.getTypescriptDependencies).toBeUndefined();
      expect(tools.searchExternalLibrarySymbols).toBeUndefined();
      expect(tools.resolveSymbol).toBeUndefined();
      expect(tools.getAvailableExternalSymbols).toBeUndefined();
      expect(tools.parseImports).toBeUndefined();
    });

    it("should include TypeScript tools when TypeScript is enabled", () => {
      const tools = getSerenityTools({
        languageFeatures: {
          typescript: { enabled: true },
        },
      });

      // Core tools should still be present
      expect(tools.replaceSymbolBody).toBeDefined();
      expect(tools.listMemories).toBeDefined();

      // TypeScript tools should be present
      expect(tools.indexExternalLibraries).toBeDefined();
      expect(tools.getTypescriptDependencies).toBeDefined();
      expect(tools.searchExternalLibrarySymbols).toBeDefined();
      expect(tools.resolveSymbol).toBeDefined();
      expect(tools.getAvailableExternalSymbols).toBeDefined();
      expect(tools.parseImports).toBeDefined();
    });

    it("should not include TypeScript tools when explicitly disabled", () => {
      const tools = getSerenityTools({
        languageFeatures: {
          typescript: { enabled: false },
        },
      });

      // TypeScript tools should NOT be present
      expect(tools.indexExternalLibraries).toBeUndefined();
      expect(tools.getTypescriptDependencies).toBeUndefined();
      expect(tools.searchExternalLibrarySymbols).toBeUndefined();
    });

    it("should handle multiple language configs (future-proofing)", () => {
      const tools = getSerenityTools({
        languageFeatures: {
          typescript: { enabled: true },
          rust: { enabled: false },
          go: { enabled: false },
          python: { enabled: false },
        },
      });

      // Only TypeScript tools should be present
      expect(tools.indexExternalLibraries).toBeDefined();

      // Count total tools
      const toolCount = Object.keys(tools).length;
      const coreToolCount = 13; // Number of core tools (added replaceRange)
      const typescriptToolCount = 6; // Number of TypeScript-specific tools

      expect(toolCount).toBe(coreToolCount + typescriptToolCount);
    });
  });

  describe("getSerenityToolsList", () => {
    it("should return array of core tools when no config", () => {
      const tools = getSerenityToolsList();

      // Should be an array
      expect(Array.isArray(tools)).toBe(true);

      // Should contain only core tools
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain("replace_symbol_body");
      expect(toolNames).toContain("list_memories");
      expect(toolNames).toContain("list_dir");

      // Should NOT contain TypeScript tools
      expect(toolNames).not.toContain("index_external_libraries");
      expect(toolNames).not.toContain("search_external_library_symbols");
    });

    it("should include TypeScript tools when enabled", () => {
      const tools = getSerenityToolsList({
        languageFeatures: {
          typescript: { enabled: true },
        },
      });

      const toolNames = tools.map((t) => t.name);

      // Should contain both core and TypeScript tools
      expect(toolNames).toContain("replace_symbol_body");
      expect(toolNames).toContain("index_external_libraries");
      expect(toolNames).toContain("search_external_library_symbols");
      expect(toolNames).toContain("resolve_symbol");
    });

    it("should return consistent tool count", () => {
      const noConfigTools = getSerenityToolsList();
      const typescriptEnabledTools = getSerenityToolsList({
        languageFeatures: {
          typescript: { enabled: true },
        },
      });

      // TypeScript adds 6 tools
      expect(typescriptEnabledTools.length).toBe(noConfigTools.length + 6);
    });
  });
});
