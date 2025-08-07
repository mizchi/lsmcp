import { describe, it, expect } from "vitest";
import {
  configSchema,
  DEFAULT_CONFIG,
  validateConfig,
  createConfigFromAdapter,
} from "./configSchema.ts";

describe("configSchema", () => {
  describe("configSchema validation", () => {
    it("should validate a minimal config", () => {
      const minimalConfig = {
        version: "1.0",
      };
      const result = configSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe("1.0");
        // Check defaults are applied
        expect(result.data.indexFiles).toEqual([
          "**/*.ts",
          "**/*.tsx",
          "**/*.js",
          "**/*.jsx",
        ]);
      }
    });

    it("should validate a complete config", () => {
      const completeConfig = {
        version: "1.0",
        indexFiles: ["src/**/*.ts"],
        adapter: {
          id: "test",
          name: "Test LSP",
          bin: "test-lsp",
          args: ["--stdio"],
          baseLanguage: "test",
          description: "Test language server",
        },
        settings: {
          autoIndex: true,
          indexConcurrency: 10,
          autoIndexDelay: 1000,
          enableWatchers: false,
          memoryLimit: 2048,
        },
        symbolFilter: {
          excludeKinds: ["Variable", "Constant"],
          excludePatterns: ["test"],
          includeOnlyTopLevel: true,
        },
        ignorePatterns: ["**/test/**"],
      };

      const result = configSchema.safeParse(completeConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.adapter?.id).toBe("test");
        expect(result.data.settings.autoIndex).toBe(true);
        expect(result.data.symbolFilter?.excludeKinds).toEqual([
          "Variable",
          "Constant",
        ]);
      }
    });

    it("should reject invalid version", () => {
      const invalidConfig = {
        version: "2.0",
      };
      const result = configSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it("should reject invalid concurrency", () => {
      const invalidConfig = {
        version: "1.0",
        settings: {
          indexConcurrency: 25, // Max is 20
        },
      };
      const result = configSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it("should apply default values", () => {
      const config = {
        version: "1.0",
        settings: {},
      };
      const result = configSchema.parse(config);
      expect(result.settings.autoIndex).toBe(false);
      expect(result.settings.indexConcurrency).toBe(5);
      expect(result.settings.autoIndexDelay).toBe(500);
      expect(result.settings.enableWatchers).toBe(true);
      expect(result.settings.memoryLimit).toBe(1024);
    });
  });

  describe("DEFAULT_CONFIG", () => {
    it("should have valid default configuration", () => {
      expect(DEFAULT_CONFIG.version).toBe("1.0");
      expect(DEFAULT_CONFIG.indexFiles).toEqual([
        "**/*.ts",
        "**/*.tsx",
        "**/*.js",
        "**/*.jsx",
      ]);
      expect(DEFAULT_CONFIG.settings.autoIndex).toBe(false);
      expect(DEFAULT_CONFIG.settings.indexConcurrency).toBe(5);
      expect(DEFAULT_CONFIG.symbolFilter?.excludeKinds).toContain("Variable");
      expect(DEFAULT_CONFIG.ignorePatterns).toContain("**/node_modules/**");
    });

    it("should be valid according to schema", () => {
      const result = configSchema.safeParse(DEFAULT_CONFIG);
      expect(result.success).toBe(true);
    });
  });

  describe("validateConfig", () => {
    it("should validate and return valid config", () => {
      const config = {
        version: "1.0",
        indexFiles: ["**/*.py"],
      };
      const result = validateConfig(config);
      expect(result.version).toBe("1.0");
      expect(result.indexFiles).toEqual(["**/*.py"]);
    });

    it("should throw on invalid config", () => {
      const invalidConfig = {
        version: "invalid",
      };
      expect(() => validateConfig(invalidConfig)).toThrow();
    });

    it("should parse and apply defaults", () => {
      const minimalConfig = { version: "1.0" };
      const result = validateConfig(minimalConfig);
      expect(result.settings.autoIndex).toBe(false);
      expect(result.settings.indexConcurrency).toBe(5);
    });
  });

  describe("createConfigFromAdapter", () => {
    it("should create config from adapter", () => {
      const adapter = {
        id: "python",
        name: "Python LSP",
        bin: "pylsp",
        args: ["--stdio"],
        baseLanguage: "python",
        description: "Python language server",
      };

      const config = createConfigFromAdapter(adapter);
      expect(config.version).toBe("1.0");
      expect(config.adapter).toEqual(adapter);
      expect(config.indexFiles).toEqual([
        "**/*.ts",
        "**/*.tsx",
        "**/*.js",
        "**/*.jsx",
      ]); // Default patterns
    });

    it("should use custom index patterns", () => {
      const adapter = {
        id: "python",
        name: "Python LSP",
        bin: "pylsp",
        baseLanguage: "python",
      };
      const patterns = ["**/*.py", "**/*.pyi"];

      const config = createConfigFromAdapter(adapter, patterns);
      expect(config.indexFiles).toEqual(patterns);
    });

    it("should include all default settings", () => {
      const adapter = {
        id: "test",
        name: "Test",
        bin: "test",
      };

      const config = createConfigFromAdapter(adapter);
      expect(config.settings).toBeDefined();
      expect(config.settings.autoIndex).toBe(false);
      expect(config.symbolFilter).toBeDefined();
      expect(config.ignorePatterns).toBeDefined();
    });
  });
});
