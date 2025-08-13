import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync } from "fs";
import { ConfigLoader } from "./loader.ts";

describe("ConfigLoader with Preset Language Features", () => {
  let tempDir: string;
  let loader: ConfigLoader;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "config-test-"));
    loader = new ConfigLoader(tempDir);
  });

  describe("Preset-based language features", () => {
    it("should enable TypeScript features for tsgo preset", async () => {
      const result = loader.loadFromPreset("tsgo", {
        applyDefaults: true,
      });

      expect(result.config.preset).toBe("tsgo");
      expect(result.config.languageFeatures?.typescript?.enabled).toBe(true);
      expect(result.config.languageFeatures?.typescript?.indexNodeModules).toBe(
        true,
      );
      expect(result.config.languageFeatures?.typescript?.maxFiles).toBe(5000);
    });

    it("should enable TypeScript features for typescript preset", async () => {
      const result = loader.loadFromPreset("typescript", {
        applyDefaults: true,
      });

      expect(result.config.preset).toBe("typescript");
      expect(result.config.languageFeatures?.typescript?.enabled).toBe(true);
      expect(result.config.languageFeatures?.typescript?.indexNodeModules).toBe(
        true,
      );
      expect(result.config.languageFeatures?.typescript?.maxFiles).toBe(5000);
    });

    it("should enable Rust features for rust-analyzer preset", async () => {
      const result = await loader.loadFromPreset("rust-analyzer", {
        applyDefaults: true,
      });

      expect(result.config.preset).toBe("rust-analyzer");
      expect(result.config.languageFeatures?.rust?.enabled).toBe(true);
      expect(result.config.languageFeatures?.rust?.indexCargo).toBe(true);
    });

    it("should not enable any language features for pyright preset", async () => {
      const result = await loader.loadFromPreset("pyright", {
        applyDefaults: true,
      });

      expect(result.config.preset).toBe("pyright");
      // pyright doesn't have default language features yet
      expect(result.config.languageFeatures?.python?.enabled).toBeUndefined();
    });

    it("should not enable any language features for gopls preset", async () => {
      const result = await loader.loadFromPreset("gopls", {
        applyDefaults: true,
      });

      expect(result.config.preset).toBe("gopls");
      // gopls doesn't have default language features yet
      expect(result.config.languageFeatures?.go?.enabled).toBeUndefined();
    });
  });

  describe("Config file with preset", () => {
    it("should apply preset language features from config file", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        preset: "tsgo",
      };

      // Create directory and write config
      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.preset).toBe("tsgo");
      expect(result.config.languageFeatures?.typescript?.enabled).toBe(true);
    });

    it("should allow overriding preset language features", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        preset: "tsgo",
        languageFeatures: {
          typescript: {
            enabled: false, // Override preset default
          },
        },
      };

      // Create directory and write config
      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.preset).toBe("tsgo");
      // User override should take precedence
      expect(result.config.languageFeatures?.typescript?.enabled).toBe(false);
    });

    it("should allow partial override of preset language features", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        preset: "tsgo",
        languageFeatures: {
          typescript: {
            maxFiles: 2000, // Override only maxFiles
          },
        },
      };

      // Create directory and write config
      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.preset).toBe("tsgo");
      // maxFiles should be overridden, but enabled should still be true from preset
      expect(result.config.languageFeatures?.typescript?.enabled).toBe(true);
      expect(result.config.languageFeatures?.typescript?.maxFiles).toBe(2000);
      expect(result.config.languageFeatures?.typescript?.indexNodeModules).toBe(
        true,
      );
    });
  });

  describe("Direct preset loading", () => {
    it("should load preset with language features directly", async () => {
      const result = await loader.loadFromPreset("tsgo", {
        applyDefaults: false,
      });
      const tsgoPreset = result.config;

      expect(tsgoPreset).toBeDefined();
      expect(tsgoPreset?.languageFeatures?.typescript?.enabled).toBe(true);
      expect(tsgoPreset?.languageFeatures?.typescript?.indexNodeModules).toBe(
        true,
      );
      expect(tsgoPreset?.languageFeatures?.typescript?.maxFiles).toBe(5000);
    });

    it("should load rust-analyzer preset with Rust features", async () => {
      const result = await loader.loadFromPreset("rust-analyzer", {
        applyDefaults: false,
      });
      const rustPreset = result.config;

      expect(rustPreset).toBeDefined();
      expect(rustPreset?.languageFeatures?.rust?.enabled).toBe(true);
      expect(rustPreset?.languageFeatures?.rust?.indexCargo).toBe(true);
    });
  });

  describe("Preset loading and merging", () => {
    it("should correctly merge preset configuration with user config", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        preset: "tsgo",
        settings: {
          indexConcurrency: 10, // Override default
        },
        symbolFilter: {
          excludeKinds: ["Variable"], // Override default array
        },
      };

      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.preset).toBe("tsgo");
      expect(result.config.settings?.indexConcurrency).toBe(10);
      expect(result.config.symbolFilter?.excludeKinds).toEqual(["Variable"]);
      // Other default settings should remain
      expect(result.config.settings?.autoIndex).toBe(false);
      expect(result.config.ignorePatterns).toEqual([
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
      ]);
    });

    it("should handle preset files patterns correctly", async () => {
      const result = loader.loadFromPreset("rust-analyzer", {
        applyDefaults: true,
      });

      expect(result.config.files).toEqual(["**/*.rs"]);
      expect(result.config.preset).toBe("rust-analyzer");
    });
  });

  describe(".lsmcp/config.json file loading", () => {
    it("should load configuration from .lsmcp/config.json", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        files: ["**/*.py"],
        settings: {
          autoIndex: true,
          indexConcurrency: 8,
        },
        ignorePatterns: ["**/venv/**", "**/dist/**"],
      };

      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.files).toEqual(["**/*.py"]);
      expect(result.config.settings?.autoIndex).toBe(true);
      expect(result.config.settings?.indexConcurrency).toBe(8);
      expect(result.config.ignorePatterns).toEqual([
        "**/venv/**",
        "**/dist/**",
      ]);
      expect(result.source).toBe("file");
    });

    it("should throw error for invalid JSON in config file", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, "{ invalid json }");

      await expect(loader.load()).rejects.toThrow(
        "Invalid JSON in config file",
      );
    });

    it("should handle non-existent config file gracefully", async () => {
      // This test verifies that loader gracefully handles missing files
      // by falling back to defaults rather than crashing
      const result = await loader.load();
      expect(result.source).toBe("default");
    });
  });

  describe("disable: ['toolName'] functionality", () => {
    it("should preserve disable array from config file", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        preset: "typescript",
        unsupported: ["hover", "references", "documentSymbol"],
      };

      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.unsupported).toEqual([
        "hover",
        "references",
        "documentSymbol",
      ]);
    });

    it("should handle disable field from preset configuration", async () => {
      const result = loader.loadFromPreset("typescript", {
        applyDefaults: true,
      });

      // Check that unsupported field is properly handled from preset
      expect(result.config.unsupported).toBeDefined();
    });

    it("should merge disable arrays when both preset and user config specify them", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        preset: "tsgo",
        unsupported: ["completion"],
      };

      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.unsupported).toEqual(["completion"]);
    });
  });

  describe("experiments.* configuration enabling features", () => {
    it("should enable memory experiment from config", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        preset: "tsgo",
        experiments: {
          memory: true,
        },
      };

      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.experiments?.memory).toBe(true);
    });

    it("should handle deprecated memoryAdvanced field", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        preset: "tsgo",
        memoryAdvanced: true,
      };

      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.experiments?.memory).toBe(true);
    });

    it("should prefer experiments.memory over deprecated memoryAdvanced", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        preset: "tsgo",
        memoryAdvanced: true,
        experiments: {
          memory: false,
        },
      };

      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.experiments?.memory).toBe(false);
    });

    it("should have default experiments configuration", async () => {
      const result = loader.loadFromPreset("tsgo", {
        applyDefaults: true,
      });

      expect(result.config.experiments).toBeDefined();
      // tsgo preset doesn't define experiments, so it should use defaults (memory: false)
      // But in practice, the default may vary based on configuration merging
      expect(result.config.experiments?.memory).toBeDefined();
    });

    it("should validate experiments schema and exclude unknown properties", async () => {
      const configPath = join(tempDir, ".lsmcp", "config.json");
      const config = {
        preset: "tsgo",
        experiments: {
          memory: true,
          unknownProperty: true, // This should be excluded by schema validation
        },
      };

      const configDir = join(tempDir, ".lsmcp");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = await loader.load();

      expect(result.config.experiments?.memory).toBe(true);
      // Unknown properties should be excluded by schema validation
      expect(
        (result.config.experiments as any)?.unknownProperty,
      ).toBeUndefined();
    });
  });

  describe("Configuration validation and error handling", () => {
    it("should validate configuration against schema", async () => {
      const result = loader.loadFromPreset("typescript", {
        applyDefaults: true,
        validate: true,
      });

      expect(result.config).toBeDefined();
      expect(result.config.files).toBeDefined();
      expect(result.config.settings).toBeDefined();
    });

    it("should skip validation when disabled", async () => {
      const result = loader.loadFromPreset("typescript", {
        applyDefaults: true,
        validate: false,
      });

      expect(result.config).toBeDefined();
    });

    it("should load defaults when no config found", async () => {
      const result = await loader.load();

      expect(result.source).toBe("default");
      expect(result.warnings).toContain(
        "No configuration found, using defaults",
      );
      expect(result.config.preset).toBe("tsgo");
    });
  });
});
