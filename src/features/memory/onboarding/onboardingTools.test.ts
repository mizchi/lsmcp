/**
 * Tests for onboarding tools
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
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

  describe("indexOnboardingTool", () => {
    it("should return onboarding instructions", async () => {
      const result = await indexOnboardingTool.execute({ root: testRoot });

      expect(result).toContain("setting up lsmcp's symbol indexing");
      expect(result).toContain("Project: " + testRoot);
      expect(result).toContain("1. Explore Project Structure");
      expect(result).toContain("2. Index the Codebase");
      expect(result).toContain("3. Verify Index Success");
      expect(result).toContain("4. Test Symbol Search");
    });
  });

  describe("getSymbolSearchGuidanceTool", () => {
    it("should return symbol search guidance", async () => {
      const result = await getSymbolSearchGuidanceTool.execute({});

      expect(result).toContain("searching for symbols");
      expect(result).toContain("search_symbol");
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
