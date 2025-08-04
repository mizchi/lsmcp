import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import {
  checkOnboardingPerformedTool,
  onboardingTool,
  thinkAboutCollectedInformationTool,
  thinkAboutTaskAdherenceTool,
  thinkAboutWhetherYouAreDoneTool,
} from "./workflowTools.ts";

// Mock fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

// Mock process.cwd
const originalCwd = process.cwd;

describe("workflowTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.cwd = vi.fn(() => "/test/project");
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  describe("checkOnboardingPerformedTool", () => {
    it("should return true when .lsmcp/memories directory and suggested_commands.md exist", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return (
          pathStr === "/test/project/.lsmcp/memories" ||
          pathStr === "/test/project/.lsmcp/memories/suggested_commands.md"
        );
      });

      const result = await checkOnboardingPerformedTool.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.onboardingPerformed).toBe(true);
      expect(parsed.message).toBe(
        "Onboarding has been performed. Memories are available.",
      );
    });

    it("should return false when .lsmcp/memories directory does not exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await checkOnboardingPerformedTool.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.onboardingPerformed).toBe(false);
      expect(parsed.message).toBe(
        "Onboarding not yet performed. You should run the onboarding tool.",
      );
    });

    it("should return false when suggested_commands.md does not exist", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr === "/test/project/.lsmcp/memories";
      });

      const result = await checkOnboardingPerformedTool.execute({});
      const parsed = JSON.parse(result);

      expect(parsed.onboardingPerformed).toBe(false);
      expect(parsed.message).toBe(
        "Onboarding not yet performed. You should run the onboarding tool.",
      );
    });
  });

  describe("onboardingTool", () => {
    it("should return onboarding prompt with system info", async () => {
      const result = await onboardingTool.execute({});

      expect(result).toContain(
        "You are viewing the project for the first time",
      );
      expect(result).toContain("the project's purpose");
      expect(result).toContain("the tech stack used");
      expect(result).toContain(".lsmcp/config.json configuration");
      expect(result).toContain("symbol indexing system");
      expect(result).toContain("_from_index suffix");
    });
  });

  describe("thinkAboutCollectedInformationTool", () => {
    it("should return thinking prompt about collected information", async () => {
      const result = await thinkAboutCollectedInformationTool.execute({});

      expect(result).toContain("Have you collected all the information");
      expect(result).toContain("symbol discovery");
    });
  });

  describe("thinkAboutTaskAdherenceTool", () => {
    it("should return thinking prompt about task adherence", async () => {
      const result = await thinkAboutTaskAdherenceTool.execute({});

      expect(result).toContain("Are you deviating from the task");
      expect(result).toContain("memory files");
    });
  });

  describe("thinkAboutWhetherYouAreDoneTool", () => {
    it("should return thinking prompt about completion", async () => {
      const result = await thinkAboutWhetherYouAreDoneTool.execute({});

      expect(result).toContain("Have you already performed all the steps");
      expect(result).toContain("symbol index needs updating");
    });
  });
});
