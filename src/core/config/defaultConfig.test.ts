import { describe, it, expect } from "vitest";
import {
  DEFAULT_BASE_CONFIG,
  DEFAULT_TYPESCRIPT_ADAPTER,
  mergeConfigs,
  createCompleteConfig,
} from "./defaultConfig.ts";

describe("defaultConfig", () => {
  describe("DEFAULT_BASE_CONFIG", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_BASE_CONFIG.version).toBe("1.0");
      expect(DEFAULT_BASE_CONFIG.indexFiles).toEqual([
        "**/*.ts",
        "**/*.tsx",
        "**/*.js",
        "**/*.jsx",
      ]);
      expect(DEFAULT_BASE_CONFIG.settings?.autoIndex).toBe(false);
      expect(DEFAULT_BASE_CONFIG.settings?.indexConcurrency).toBe(5);
      expect(DEFAULT_BASE_CONFIG.symbolFilter?.excludeKinds).toContain(
        "Variable",
      );
      expect(DEFAULT_BASE_CONFIG.symbolFilter?.excludeKinds).toContain(
        "Constant",
      );
      expect(DEFAULT_BASE_CONFIG.ignorePatterns).toContain(
        "**/node_modules/**",
      );
    });
  });

  describe("DEFAULT_TYPESCRIPT_ADAPTER", () => {
    it("should have correct TypeScript adapter configuration", () => {
      expect(DEFAULT_TYPESCRIPT_ADAPTER.id).toBe("tsgo");
      expect(DEFAULT_TYPESCRIPT_ADAPTER.name).toBe("tsgo");
      expect(DEFAULT_TYPESCRIPT_ADAPTER.baseLanguage).toBe("typescript");
      expect(DEFAULT_TYPESCRIPT_ADAPTER.bin).toBe("npx");
      expect(DEFAULT_TYPESCRIPT_ADAPTER.args).toEqual([
        "-y",
        "tsgo",
        "--lsp",
        "--stdio",
      ]);
      expect(DEFAULT_TYPESCRIPT_ADAPTER.unsupported).toContain(
        "get_workspace_symbols",
      );
    });
  });

  describe("mergeConfigs", () => {
    it("should merge base and override configs", () => {
      const base: any = {
        version: "1.0",
        indexFiles: ["**/*.ts"],
        settings: {
          autoIndex: false,
          indexConcurrency: 5,
        },
      };

      const override: any = {
        indexFiles: ["**/*.js"],
        settings: {
          autoIndex: true,
        },
      };

      const result = mergeConfigs(base, override);
      expect(result.version).toBe("1.0");
      expect(result.indexFiles).toEqual(["**/*.js"]); // Arrays are replaced
      expect(result.settings?.autoIndex).toBe(true);
      expect(result.settings?.indexConcurrency).toBe(5); // Preserved from base
    });

    it("should deep merge nested objects", () => {
      const base = {
        version: "1.0" as const,
        adapter: {
          id: "base",
          name: "Base Adapter",
          bin: "base-bin",
          initializationOptions: {
            option1: "value1",
            option2: "value2",
          },
        },
      };

      const override = {
        adapter: {
          id: "override",
          name: "Override Adapter",
          bin: "override-bin",
          initializationOptions: {
            option2: "newValue2",
            option3: "value3",
          },
        },
      };

      const result = mergeConfigs(base, override);
      expect(result.adapter?.id).toBe("override");
      expect(result.adapter?.initializationOptions).toEqual({
        option1: "value1",
        option2: "newValue2",
        option3: "value3",
      });
    });

    it("should handle empty override", () => {
      const base = DEFAULT_BASE_CONFIG;
      const override = {};
      const result = mergeConfigs(base, override);
      expect(result).toEqual(base);
    });
  });

  describe("createCompleteConfig", () => {
    it("should return default config with TypeScript adapter when no user config", () => {
      const config = createCompleteConfig();
      expect(config.version).toBe("1.0");
      expect(config.adapter?.id).toBe("tsgo");
      expect(config.indexFiles).toEqual([
        "**/*.ts",
        "**/*.tsx",
        "**/*.js",
        "**/*.jsx",
      ]);
    });

    it("should use preset field to select adapter", () => {
      const config = createCompleteConfig({ preset: "typescript" });
      expect(config.adapter?.id).toBe("typescript");
      expect(config.adapter?.name).toBe("typescript-language-server");
    });

    it("should support legacy adapter.id field", () => {
      const config = createCompleteConfig({
        adapter: { id: "tsgo", name: "tsgo", bin: "npx" } as any,
      });
      expect(config.adapter?.id).toBe("tsgo");
      expect(config.adapter?.name).toBe("tsgo");
    });

    it("should merge user config with defaults", () => {
      const userConfig: any = {
        indexFiles: ["src/**/*.ts"],
        settings: {
          autoIndex: true,
        },
      };

      const config = createCompleteConfig(userConfig);
      expect(config.indexFiles).toEqual(["src/**/*.ts"]);
      expect(config.settings?.autoIndex).toBe(true);
      expect(config.settings?.indexConcurrency).toBe(5); // From defaults
      expect(config.adapter?.id).toBe("tsgo"); // Default adapter
    });

    it("should use user-provided adapter", () => {
      const userConfig = {
        adapter: {
          id: "custom",
          name: "Custom LSP",
          bin: "custom-lsp",
          baseLanguage: "custom",
          description: "Custom language server",
        },
      };

      const config = createCompleteConfig(userConfig);
      expect(config.adapter?.id).toBe("custom");
      expect(config.adapter?.name).toBe("Custom LSP");
      expect(config.adapter?.bin).toBe("custom-lsp");
      // Should still have default settings
      expect(config.settings?.indexConcurrency).toBe(5);
    });

    it("should handle partial adapter override", () => {
      const userConfig = {
        adapter: {
          id: "tsgo",
          name: "Modified TSGO",
          bin: "npx",
          args: ["tsgo", "--different"],
        },
      };

      const config = createCompleteConfig(userConfig);
      expect(config.adapter?.id).toBe("tsgo");
      expect(config.adapter?.name).toBe("Modified TSGO");
      expect(config.adapter?.args).toEqual(["tsgo", "--different"]);
    });
  });
});
