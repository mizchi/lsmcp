import { describe, it, expect, vi, beforeEach } from "vitest";
import { tsgoAdapter } from "./tsgo.ts";
import { resolveAdapterCommand } from "./utils.ts";

// Mock the nodeModulesUtils
vi.mock("../utils/nodeModulesUtils.ts", () => ({
  getNodeModulesBin: vi.fn(),
  getNodeModulesCommand: vi.fn(),
}));

// Mock child_process
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

describe("tsgoAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("adapter configuration", () => {
    it("should have correct basic configuration", () => {
      expect(tsgoAdapter.presetId).toBe("tsgo");
      expect(tsgoAdapter.bin).toBeUndefined();
      expect(tsgoAdapter.args).toBeUndefined();
      expect(tsgoAdapter.binFindStrategy).toBeDefined();
      expect(tsgoAdapter.binFindStrategy?.searchPaths).toEqual(["tsgo"]);
      expect(tsgoAdapter.binFindStrategy?.npxPackage).toBe(
        "@typescript/native-preview",
      );
      expect(tsgoAdapter.binFindStrategy?.defaultArgs).toEqual([
        "--lsp",
        "--stdio",
      ]);
    });

    it("should have appropriate unsupported tools", () => {
      expect(tsgoAdapter.disable).not.toContain("get_document_symbols");
      expect(tsgoAdapter.disable).not.toContain("get_workspace_symbols");
      expect(tsgoAdapter.disable).toContain("get_code_actions");
      expect(tsgoAdapter.disable).toContain("rename_symbol");
      expect(tsgoAdapter.disable).toContain("delete_symbol");
    });

    it("should have server characteristics configured", () => {
      expect(tsgoAdapter.serverCharacteristics).toEqual({
        documentOpenDelay: 500,
        readinessCheckTimeout: 200,
        initialDiagnosticsTimeout: 1000,
        requiresProjectInit: false,
        sendsInitialDiagnostics: false,
        operationTimeout: 5000,
      });
    });

    it("should have initialization options for TypeScript", () => {
      expect(tsgoAdapter.initializationOptions).toEqual({
        preferences: {
          includeInlayParameterNameHints: "none",
          includeInlayParameterNameHintsWhenArgumentMatchesName: false,
          includeInlayFunctionParameterTypeHints: false,
          includeInlayVariableTypeHints: false,
          includeInlayPropertyDeclarationTypeHints: false,
          includeInlayFunctionLikeReturnTypeHints: false,
          includeInlayEnumMemberValueHints: false,
        },
        maxTsServerMemory: 4096,
      });
    });

    it("should enable diagnostic deduplication", () => {
      expect(tsgoAdapter.needsDiagnosticDeduplication).toBe(true);
    });
  });

  describe("resolveAdapterCommand", () => {
    it("should use binFindStrategy to resolve command", () => {
      // The command will be resolved through binFindStrategy
      const result = resolveAdapterCommand(tsgoAdapter, "/project");

      // It should either find tsgo or fallback to npx
      expect(result).toBeDefined();
      expect(result.command).toBeDefined();
      expect(result.args).toContain("--lsp");
      expect(result.args).toContain("--stdio");

      // If npx fallback is used
      if (result.command === "npx") {
        expect(result.args).toContain("-y");
        expect(result.args).toContain("@typescript/native-preview");
      }
    });

    it("should not call getNodeModulesCommand when using binFindStrategy", async () => {
      const { getNodeModulesCommand } = await import(
        "../utils/nodeModulesUtils.ts"
      );
      const mockGetNodeModulesCommand = vi.mocked(getNodeModulesCommand);

      const result = resolveAdapterCommand(tsgoAdapter, "/project");

      expect(mockGetNodeModulesCommand).not.toHaveBeenCalled();
      expect(result.args).toContain("--lsp");
      expect(result.args).toContain("--stdio");
    });
  });
});
