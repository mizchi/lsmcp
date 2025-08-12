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

  describe.skip("Preset-based language features", () => {
    it("should enable TypeScript features for tsgo preset", async () => {
      const result = await loader.loadFromPreset("tsgo", {
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
      const result = await loader.loadFromPreset("typescript", {
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

  describe.skip("Config file with preset", () => {
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

  describe.skip("Direct preset loading", () => {
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
});
