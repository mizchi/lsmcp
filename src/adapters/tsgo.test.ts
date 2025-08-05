import { describe, it, expect, vi, beforeEach } from "vitest";
import { tsgoAdapter } from "./tsgo.ts";
import { resolveAdapterCommand } from "./utils.ts";
import * as nodeModulesUtils from "../core/io/nodeModulesUtils.ts";
import * as childProcess from "child_process";

// Mock the nodeModulesUtils
vi.mock("../core/io/nodeModulesUtils.ts", () => ({
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
      expect(tsgoAdapter.id).toBe("tsgo");
      expect(tsgoAdapter.name).toBe("tsgo");
      expect(tsgoAdapter.baseLanguage).toBe("typescript");
      expect(tsgoAdapter.bin).toBe("npx");
      expect(tsgoAdapter.args).toEqual(["tsgo", "--lsp", "--stdio"]);
    });

    it("should have appropriate unsupported tools", () => {
      expect(tsgoAdapter.unsupported).not.toContain("get_document_symbols");
      expect(tsgoAdapter.unsupported).not.toContain("get_workspace_symbols");
      expect(tsgoAdapter.unsupported).toContain("get_code_actions");
      expect(tsgoAdapter.unsupported).toContain("rename_symbol");
      expect(tsgoAdapter.unsupported).toContain("delete_symbol");
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
    it("should return npx command with args as configured", () => {
      // Since tsgoAdapter.bin is "npx", it won't go through nodeModulesBinaries resolution
      const result = resolveAdapterCommand(tsgoAdapter, "/project");

      expect(result).toEqual({
        command: "npx",
        args: ["tsgo", "--lsp", "--stdio"],
      });
    });

    it("should not call getNodeModulesCommand for npx bin", () => {
      const mockGetNodeModulesCommand = vi.mocked(
        nodeModulesUtils.getNodeModulesCommand,
      );

      const result = resolveAdapterCommand(tsgoAdapter, "/project");

      expect(mockGetNodeModulesCommand).not.toHaveBeenCalled();
      expect(result).toEqual({
        command: "npx",
        args: ["tsgo", "--lsp", "--stdio"],
      });
    });
  });

  describe("doctor", () => {
    it("should return ok when tsgo is available in node_modules", async () => {
      const mockGetNodeModulesBin = vi.mocked(
        nodeModulesUtils.getNodeModulesBin,
      );
      mockGetNodeModulesBin.mockReturnValue("/project/node_modules/.bin/tsgo");

      const result = await tsgoAdapter.doctor!();

      expect(result).toEqual({ ok: true });
      expect(mockGetNodeModulesBin).toHaveBeenCalledWith("tsgo");
    });

    it("should return error when tsgo is not available", async () => {
      const mockGetNodeModulesBin = vi.mocked(
        nodeModulesUtils.getNodeModulesBin,
      );
      mockGetNodeModulesBin.mockReturnValue(null);

      const mockExecSync = vi.mocked(childProcess.execSync);
      mockExecSync.mockImplementation(() => {
        throw new Error("Command not found");
      });

      const result = await tsgoAdapter.doctor!();

      expect(result).toEqual({
        ok: false,
        message: "tsgo not found. Install with: npm install -g tsgo",
      });
    });
  });
});
