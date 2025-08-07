import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConfigLoader } from "./loader.ts";
import * as fs from "fs";

// Mock fs module
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe("ConfigLoader", () => {
  let loader: ConfigLoader;
  const mockRootPath = "/test/project";

  beforeEach(() => {
    loader = new ConfigLoader(mockRootPath);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("load", () => {
    it("should load from direct config object", async () => {
      const config = {
        preset: "tsgo",
        indexFiles: ["**/*.ts"],
      };

      const result = await loader.load({ config });

      expect(result.source).toBe("config");
      expect(result.config.preset).toBe("tsgo");
      expect(result.config.indexFiles).toEqual(["**/*.ts"]);
      expect(result.config.version).toBe("1.0"); // Default applied
    });

    it("should load from preset", async () => {
      const result = await loader.load({ preset: "typescript" });

      expect(result.source).toBe("preset");
      expect(result.config.preset).toBe("typescript");
      expect(result.config.lsp?.bin).toBe("typescript-language-server");
    });

    it("should throw for unknown preset", async () => {
      await expect(loader.load({ preset: "unknown" })).rejects.toThrow(
        "Unknown preset: unknown",
      );
    });

    it("should load from config file", async () => {
      const configPath = ".lsmcp/config.json";
      const configContent = JSON.stringify({
        preset: "tsgo",
        indexFiles: ["src/**/*.ts"],
        settings: {
          autoIndex: true,
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const result = await loader.load({ configFile: configPath });

      expect(result.source).toBe("file");
      expect(result.config.indexFiles).toEqual(["src/**/*.ts"]);
      expect(result.config.settings?.autoIndex).toBe(true);
    });

    it("should handle file with preset reference", async () => {
      const configContent = JSON.stringify({
        preset: "pyright",
        settings: {
          autoIndex: true,
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const result = await loader.load({ configFile: "config.json" });

      expect(result.source).toBe("file");
      expect(result.config.preset).toBe("pyright");
      expect(result.config.lsp?.bin).toBe("pyright-langserver");
      expect(result.config.settings?.autoIndex).toBe(true);
    });

    it("should auto-detect config file", async () => {
      const configContent = JSON.stringify({
        preset: "gopls",
      });

      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path.toString().includes(".lsmcp/config.json");
      });
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const result = await loader.load();

      expect(result.source).toBe("file");
      expect(result.config.preset).toBe("gopls");
    });

    it("should return defaults when no config found", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await loader.load();

      expect(result.source).toBe("default");
      expect(result.warnings).toContain(
        "No configuration found, using defaults",
      );
      expect(result.config.preset).toBe("tsgo");
    });

    it("should cache results", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result1 = await loader.load();
      const result2 = await loader.load();

      expect(result1).toBe(result2); // Same object reference
      expect(fs.existsSync).toHaveBeenCalledTimes(4); // Only called once for auto-detect
    });

    it("should bypass cache when sources provided", async () => {
      const result1 = await loader.load({ preset: "tsgo" });
      const result2 = await loader.load({ preset: "typescript" });

      expect(result1).not.toBe(result2);
      expect(result1.config.preset).toBe("tsgo");
      expect(result2.config.preset).toBe("typescript");
    });

    it("should handle invalid JSON in config file", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("{ invalid json");

      await expect(loader.load({ configFile: "config.json" })).rejects.toThrow(
        "Invalid JSON",
      );
    });

    it("should handle missing config file", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(loader.load({ configFile: "missing.json" })).rejects.toThrow(
        "Configuration file not found",
      );
    });

    it("should skip validation when requested", async () => {
      const invalidConfig = {
        version: "2.0" as any, // Invalid version
      };

      const result = await loader.load(
        { config: invalidConfig },
        { validate: false },
      );

      expect(result.config.version).toBe("2.0");
    });

    it("should skip defaults when requested", async () => {
      const minimalConfig = {
        preset: "tsgo",
      };

      const result = await loader.load(
        { config: minimalConfig },
        { applyDefaults: false, validate: false },
      );

      expect(result.config.version).toBe("1.0"); // Version is always added
      expect(result.config.preset).toBe("tsgo");
      expect(result.config.settings).toBeUndefined();
      expect(result.config.symbolFilter).toBeUndefined();
    });
  });

  describe("static methods", () => {
    it("should return available presets", () => {
      const presets = ConfigLoader.getAvailablePresets();

      expect(presets).toContain("tsgo");
      expect(presets).toContain("typescript");
      expect(presets).toContain("rust-analyzer");
      expect(presets).toContain("pyright");
      expect(presets).toContain("gopls");
    });

    it("should get preset configuration", () => {
      const preset = ConfigLoader.getPreset("tsgo");

      expect(preset).toBeDefined();
      expect(preset?.preset).toBe("tsgo");
      expect(preset?.lsp?.bin).toBe("npx");
    });

    it("should return undefined for unknown preset", () => {
      const preset = ConfigLoader.getPreset("unknown");
      expect(preset).toBeUndefined();
    });

    it("should validate configuration", () => {
      const config = {
        version: "1.0",
        preset: "tsgo",
      };

      const validated = ConfigLoader.validate(config);

      expect(validated.version).toBe("1.0");
      expect(validated.preset).toBe("tsgo");
    });

    it("should throw on invalid configuration", () => {
      const invalidConfig = {
        version: "2.0",
      };

      expect(() => ConfigLoader.validate(invalidConfig)).toThrow();
    });
  });

  describe("clearCache", () => {
    it("should clear cached configuration", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result1 = await loader.load();
      loader.clearCache();
      const result2 = await loader.load();

      expect(result1).not.toBe(result2); // Different objects after cache clear
      expect(result1.config).toEqual(result2.config); // But same content
    });
  });

  describe("priority order", () => {
    it("should prioritize direct config over file", async () => {
      const directConfig = { preset: "typescript" };
      const fileContent = JSON.stringify({ preset: "tsgo" });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(fileContent);

      const result = await loader.load({
        config: directConfig,
        configFile: "config.json",
      });

      expect(result.source).toBe("config");
      expect(result.config.preset).toBe("typescript");
    });

    it("should prioritize file over preset", async () => {
      const fileContent = JSON.stringify({ preset: "typescript" });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(fileContent);

      const result = await loader.load({
        configFile: "config.json",
        preset: "tsgo",
      });

      expect(result.source).toBe("file");
      expect(result.config.preset).toBe("typescript");
    });
  });

  describe("config file detection", () => {
    it("should check standard locations in order", async () => {
      const locations = [
        ".lsmcp/config.json",
        "lsmcp.config.json",
        ".lsmcprc.json",
        ".lsmcprc",
      ];

      let checkCount = 0;
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        checkCount++;
        // Return true for the third location
        return pathStr.includes(locations[2]);
      });

      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ preset: "tsgo" }),
      );

      await loader.load();

      expect(checkCount).toBeGreaterThanOrEqual(3); // Should check at least up to third location
    });
  });

  describe("deep merging", () => {
    it("should deep merge nested objects", async () => {
      const config: any = {
        settings: {
          autoIndex: true,
          // indexConcurrency not specified, should use default
        },
        lsp: {
          bin: "custom-lsp",
          initializationOptions: {
            customOption: true,
          },
        },
      };

      const result = await loader.load({ config });

      expect(result.config.settings?.autoIndex).toBe(true);
      expect(result.config.settings?.indexConcurrency).toBe(5); // From defaults
      expect(result.config.lsp?.bin).toBe("custom-lsp");
      expect(result.config.lsp?.initializationOptions?.customOption).toBe(true);
    });

    it("should replace arrays, not merge them", async () => {
      const config = {
        indexFiles: ["**/*.py"],
        ignorePatterns: ["custom/**"],
      };

      const result = await loader.load({ config });

      expect(result.config.indexFiles).toEqual(["**/*.py"]);
      expect(result.config.ignorePatterns).toEqual(["custom/**"]);
    });

    it("should handle null values", async () => {
      const config = {
        lsp: null as any,
      };

      const result = await loader.load({ config }, { validate: false });

      expect(result.config.lsp).toBeNull();
    });

    it("should skip undefined values", async () => {
      const config = {
        preset: "tsgo",
        settings: undefined,
      };

      const result = await loader.load({ config });

      expect(result.config.settings).toBeDefined(); // Should use defaults
    });
  });
});
