import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { AdapterRegistry, ConfigLoader } from "./configLoader.ts";
import type { LspAdapter } from "../../types.ts";

// Test adapters
const testAdapter: LspAdapter = {
  id: "test-adapter",
  name: "Test Adapter",
  baseLanguage: "test",
  description: "Test adapter for unit tests",
  bin: "test-lsp",
  args: ["--test", "--mode=stdio"],
  unsupported: ["get_workspace_symbols"],
  initializationOptions: { test: true },
};

const tsgoTestAdapter: LspAdapter = {
  id: "tsgo",
  name: "tsgo",
  baseLanguage: "typescript",
  description: "Fast TypeScript language server",
  bin: "npx",
  args: ["tsgo", "--lsp", "--stdio"],
  unsupported: ["get_document_symbols"],
};

describe("AdapterRegistry", () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it("should register and retrieve adapters", () => {
    registry.register(testAdapter);

    expect(registry.get("test-adapter")).toBe(testAdapter);
    expect(registry.get("non-existent")).toBeUndefined();
    expect(registry.has("test-adapter")).toBe(true);
    expect(registry.has("non-existent")).toBe(false);
  });

  it("should list all adapters", () => {
    registry.register(testAdapter);
    registry.register(tsgoTestAdapter);

    const adapters = registry.list();
    expect(adapters).toHaveLength(2);
    expect(adapters).toContain(testAdapter);
    expect(adapters).toContain(tsgoTestAdapter);
  });
});

describe("ConfigLoader", () => {
  let registry: AdapterRegistry;
  let loader: ConfigLoader;
  let tempDir: string;

  beforeEach(async () => {
    registry = new AdapterRegistry();
    registry.register(testAdapter);
    registry.register(tsgoTestAdapter);
    loader = new ConfigLoader(registry);

    // Create temp directory for test files
    tempDir = join(
      tmpdir(),
      `configloader-test-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
    );
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("preset loading", () => {
    it("should load configuration from preset", async () => {
      const config = await loader.loadConfig({
        preset: "test-adapter",
      });

      expect(config).toEqual({
        id: "test-adapter",
        name: "Test Adapter",
        bin: "test-lsp",
        args: ["--test", "--mode=stdio"],
        baseLanguage: "test",
        description: "Test adapter for unit tests",
        unsupported: ["get_workspace_symbols"],
        initializationOptions: { test: true },
      });
    });

    it("should throw error for unknown preset", async () => {
      await expect(
        loader.loadConfig({
          preset: "unknown-preset",
        }),
      ).rejects.toThrow("Unknown preset: unknown-preset");
    });
  });

  describe("config file loading", () => {
    it("should load configuration from JSON file", async () => {
      const configPath = join(tempDir, "test.json");
      const configData = {
        id: "file-config",
        name: "File Config",
        bin: "file-lsp",
        args: ["--file", "--test"],
        baseLanguage: "file",
        description: "Config from file",
      };
      await writeFile(configPath, JSON.stringify(configData, null, 2));

      const config = await loader.loadConfig({
        configFile: configPath,
      });

      expect(config).toEqual({
        id: "file-config",
        name: "File Config",
        bin: "file-lsp",
        args: ["--file", "--test"],
        baseLanguage: "file",
        description: "Config from file",
      });
    });

    it("should handle new format (bin/args) in config file", async () => {
      const configPath = join(tempDir, "new-format.json");
      const configData = {
        id: "new-format",
        name: "New Format Config",
        bin: "new-lsp",
        args: ["--new", "--format"],
      };
      await writeFile(configPath, JSON.stringify(configData, null, 2));

      const config = await loader.loadConfig({
        configFile: configPath,
      });

      expect(config.bin).toBe("new-lsp");
      expect(config.args).toEqual(["--new", "--format"]);
    });

    it("should throw error for invalid JSON file", async () => {
      const configPath = join(tempDir, "invalid.json");
      await writeFile(configPath, "{ invalid json");

      await expect(
        loader.loadConfig({
          configFile: configPath,
        }),
      ).rejects.toThrow(/Failed to load config file/);
    });

    it("should throw error for non-existent file", async () => {
      await expect(
        loader.loadConfig({
          configFile: "/non/existent/file.json",
        }),
      ).rejects.toThrow(/Failed to load config file/);
    });
  });

  describe("CLI overrides", () => {
    it("should apply bin override", async () => {
      const config = await loader.loadConfig({
        preset: "test-adapter",
        overrides: {
          bin: "custom-lsp",
        },
      });

      expect(config.bin).toBe("custom-lsp");
      expect(config.args).toEqual(["--test", "--mode=stdio"]); // Original args preserved
    });

    it("should apply args override", async () => {
      const config = await loader.loadConfig({
        preset: "test-adapter",
        overrides: {
          args: ["--custom", "--args"],
        },
      });

      expect(config.bin).toBe("test-lsp"); // Original bin preserved
      expect(config.args).toEqual(["--custom", "--args"]);
    });

    it("should apply multiple overrides", async () => {
      const config = await loader.loadConfig({
        preset: "test-adapter",
        overrides: {
          bin: "override-lsp",
          args: ["--override"],
          initializationOptions: { override: true },
        },
      });

      expect(config.bin).toBe("override-lsp");
      expect(config.args).toEqual(["--override"]);
      expect(config.initializationOptions).toEqual({ override: true });
    });

    it("should create config from overrides only", async () => {
      const config = await loader.loadConfig({
        overrides: {
          bin: "standalone-lsp",
          args: ["--standalone"],
        },
      });

      expect(config).toEqual({
        id: "custom",
        name: "Custom LSP",
        bin: "standalone-lsp",
        args: ["--standalone"],
      });
    });

    it("should throw error when no bin provided for standalone override", async () => {
      await expect(
        loader.loadConfig({
          overrides: {
            args: ["--no-bin"],
          },
        }),
      ).rejects.toThrow(/No configuration source provided/);
    });
  });

  describe("priority order", () => {
    it("should apply config file over preset", async () => {
      const configPath = join(tempDir, "override.json");
      const configData = {
        id: "file-override",
        name: "File Override",
        bin: "file-override-lsp",
      };
      await writeFile(configPath, JSON.stringify(configData, null, 2));

      const config = await loader.loadConfig({
        preset: "test-adapter",
        configFile: configPath,
      });

      // File values should override preset values
      expect(config.id).toBe("file-override");
      expect(config.name).toBe("File Override");
      expect(config.bin).toBe("file-override-lsp");
      // But preset values should be preserved where not overridden
      expect(config.baseLanguage).toBe("test");
      expect(config.unsupported).toEqual(["get_workspace_symbols"]);
    });

    it("should apply CLI overrides over config file and preset", async () => {
      const configPath = join(tempDir, "base.json");
      const configData = {
        id: "base",
        name: "Base Config",
        bin: "base-lsp",
        args: ["--base"],
      };
      await writeFile(configPath, JSON.stringify(configData, null, 2));

      const config = await loader.loadConfig({
        preset: "test-adapter",
        configFile: configPath,
        overrides: {
          bin: "final-lsp",
          args: ["--final"],
        },
      });

      // CLI overrides should have highest priority
      expect(config.bin).toBe("final-lsp");
      expect(config.args).toEqual(["--final"]);
      // Config file should override preset
      expect(config.id).toBe("base");
      expect(config.name).toBe("Base Config");
      // Preset values preserved where not overridden
      expect(config.baseLanguage).toBe("test");
    });
  });

  describe("validation", () => {
    it("should throw error when no configuration source provided", async () => {
      await expect(loader.loadConfig({})).rejects.toThrow(
        "No configuration source provided",
      );
    });

    it("should validate required fields", async () => {
      const configPath = join(tempDir, "invalid.json");
      const configData = {
        // Missing required fields
        description: "Invalid config",
      };
      await writeFile(configPath, JSON.stringify(configData, null, 2));

      await expect(
        loader.loadConfig({
          configFile: configPath,
        }),
      ).rejects.toThrow(/Invalid configuration: missing required fields/);
    });
  });
});

describe("ConfigLoader.parseBinString", () => {
  it("should parse simple command", () => {
    const result = ConfigLoader.parseBinString("deno");
    expect(result).toEqual({
      bin: "deno",
      args: [],
    });
  });

  it("should parse command with arguments", () => {
    const result = ConfigLoader.parseBinString("npx tsgo --lsp --stdio");
    expect(result).toEqual({
      bin: "npx",
      args: ["tsgo", "--lsp", "--stdio"],
    });
  });

  it("should handle extra whitespace", () => {
    const result = ConfigLoader.parseBinString("  rust-analyzer   --stdio  ");
    expect(result).toEqual({
      bin: "rust-analyzer",
      args: ["--stdio"],
    });
  });

  it("should handle empty string", () => {
    const result = ConfigLoader.parseBinString("");
    expect(result).toEqual({
      bin: "",
      args: [],
    });
  });
});

if (import.meta.vitest) {
  // In-source testing support
  const {
    describe: vitestDescribe,
    it: vitestIt,
    expect: vitestExpected,
  } = import.meta.vitest;

  vitestDescribe("configLoader basic functionality", () => {
    vitestIt("should create registry and loader", () => {
      const registry = new AdapterRegistry();
      const loader = new ConfigLoader(registry);
      vitestExpected(loader).toBeDefined();
      vitestExpected(registry).toBeDefined();
    });

    vitestIt("should parse bin string correctly", () => {
      const result = ConfigLoader.parseBinString("deno lsp");
      vitestExpected(result.bin).toBe("deno");
      vitestExpected(result.args).toEqual(["lsp"]);
    });
  });
}
