/**
 * Tests for onboarding tools
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkIndexOnboardingTool,
  indexOnboardingTool,
  getSymbolSearchGuidanceTool,
  getCompressionGuidanceTool,
} from "./onboardingTools.ts";

describe("Onboarding Tools", () => {
  const testRoot = join(process.cwd(), "test-onboarding");

  beforeEach(() => {
    // Create test directory
    mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    rmSync(testRoot, { recursive: true, force: true });
  });

  describe("checkIndexOnboardingTool", () => {
    it("should return false when onboarding not performed", async () => {
      const result = await checkIndexOnboardingTool.execute({ root: testRoot });
      const parsed = JSON.parse(result);

      expect(parsed.onboardingPerformed).toBe(false);
      expect(parsed.message).toContain("not performed");
    });

    it("should return true when onboarding is performed", async () => {
      // Create onboarding directories and files
      const memoriesPath = join(testRoot, ".lsmcp", "memories");
      mkdirSync(memoriesPath, { recursive: true });
      writeFileSync(join(memoriesPath, "symbol_index_info.md"), "# Index Info");

      const result = await checkIndexOnboardingTool.execute({ root: testRoot });
      const parsed = JSON.parse(result);

      expect(parsed.onboardingPerformed).toBe(true);
      expect(parsed.message).toContain("completed");
    });
  });

  describe("indexOnboardingTool", () => {
    it("should return onboarding instructions", async () => {
      const result = await indexOnboardingTool.execute({ root: testRoot });

      expect(result).toContain("symbol indexing capabilities");
      expect(result).toContain("Project location: " + testRoot);
      expect(result).toContain("Step 1: Understand the project structure");
      expect(result).toContain("Step 2: Build the symbol index");
      expect(result).toContain("Step 3: Verify the index");
      expect(result).toContain("Step 4: Test symbol operations");
    });
  });

  describe("getSymbolSearchGuidanceTool", () => {
    it("should return symbol search guidance", async () => {
      const result = await getSymbolSearchGuidanceTool.execute({});

      expect(result).toContain("searching for symbols");
      expect(result).toContain("new_search_symbol");
      expect(result).toContain("Symbol kinds");
      expect(result).toContain("5: Class");
      expect(result).toContain("12: Function");
    });
  });

  describe("getCompressionGuidanceTool", () => {
    it("should return compression analysis guidance", async () => {
      const result = await getCompressionGuidanceTool.execute({});

      expect(result).toContain("token compression effectiveness");
      expect(result).toContain("measure_compression");
      expect(result).toContain("90-98%");
      expect(result).toContain("compressed format includes");
    });
  });
});
