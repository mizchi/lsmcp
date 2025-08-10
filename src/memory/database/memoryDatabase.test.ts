/**
 * Tests for memory database functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryDatabase } from "./memoryDatabase.ts";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { ProjectOverview, AIAnalysis } from "./schema.ts";

describe("MemoryDatabase", () => {
  let tempDir: string;
  let db: MemoryDatabase;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lsmcp-test-"));
    db = new MemoryDatabase(tempDir);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("saveReport", () => {
    it("should save a basic report", async () => {
      const overview: ProjectOverview = {
        totalFiles: 100,
        totalSymbols: 500,
        languages: [
          { language: "TypeScript", files: 80, lines: 10000, percentage: 80 },
          { language: "JavaScript", files: 20, lines: 2500, percentage: 20 },
        ],
        structure: {
          name: "test-project",
          type: "directory",
          children: [],
        },
        symbolBreakdown: {
          classes: 50,
          interfaces: 30,
          functions: 200,
          variables: 150,
          types: 40,
          enums: 10,
          modules: 20,
        },
      };

      const reportId = await db.saveReport("main", "abc123def456", overview);

      expect(reportId).toBeTruthy();
      expect(typeof reportId).toBe("string");
    });

    it("should save a report with AI analysis", async () => {
      const overview: ProjectOverview = {
        totalFiles: 50,
        totalSymbols: 250,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 10,
          interfaces: 5,
          functions: 100,
          variables: 100,
          types: 20,
          enums: 5,
          modules: 10,
        },
      };

      const aiAnalysis: AIAnalysis = {
        summary: "Test project with clean architecture",
        architecture: "Layered architecture",
        keyComponents: [
          {
            name: "Core",
            purpose: "Business logic",
            dependencies: [],
            complexity: "low",
          },
        ],
        codeQuality: {
          maintainability: 85,
          documentationLevel: "good",
          codeConsistency: "high",
          architectureAdherence: "strong",
        },
        suggestions: ["Add more tests"],
        timestamp: new Date().toISOString(),
      };

      const reportId = await db.saveReport(
        "feature/test",
        "xyz789",
        overview,
        aiAnalysis,
      );

      expect(reportId).toBeTruthy();
    });
  });

  describe("getLatestReport", () => {
    it("should get the latest report for a branch", async () => {
      const overview: ProjectOverview = {
        totalFiles: 10,
        totalSymbols: 50,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 5,
          interfaces: 3,
          functions: 20,
          variables: 15,
          types: 5,
          enums: 1,
          modules: 1,
        },
      };

      // Save multiple reports
      await db.saveReport("main", "commit1", overview);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      const latestId = await db.saveReport("main", "commit2", overview);

      const latest = await db.getLatestReport("main");

      expect(latest).toBeTruthy();
      expect(latest?.id).toBe(latestId);
      expect(latest?.commitHash).toBe("commit2");
    });

    it("should return null for non-existent branch", async () => {
      const report = await db.getLatestReport("non-existent");
      expect(report).toBeNull();
    });
  });

  describe("getReportByCommit", () => {
    it("should get report by commit hash", async () => {
      const overview: ProjectOverview = {
        totalFiles: 25,
        totalSymbols: 125,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 15,
          interfaces: 10,
          functions: 50,
          variables: 30,
          types: 10,
          enums: 5,
          modules: 5,
        },
      };

      await db.saveReport("develop", "unique-commit-hash", overview);

      const report = await db.getReportByCommit("unique-commit-hash");

      expect(report).toBeTruthy();
      expect(report?.commitHash).toBe("unique-commit-hash");
      expect(report?.branch).toBe("develop");
    });
  });

  describe("updateAIAnalysis", () => {
    it("should update AI analysis for existing report", async () => {
      const overview: ProjectOverview = {
        totalFiles: 30,
        totalSymbols: 150,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 20,
          interfaces: 15,
          functions: 60,
          variables: 35,
          types: 10,
          enums: 5,
          modules: 5,
        },
      };

      const reportId = await db.saveReport("main", "commit123", overview);

      const aiAnalysis: AIAnalysis = {
        summary: "Updated analysis",
        architecture: "Microservices",
        keyComponents: [],
        codeQuality: {
          maintainability: 90,
          documentationLevel: "excellent",
          codeConsistency: "high",
          architectureAdherence: "strong",
        },
        suggestions: [],
        timestamp: new Date().toISOString(),
      };

      await db.updateAIAnalysis(reportId, aiAnalysis);

      const report = await db.getReportByCommit("commit123");

      expect(report?.aiAnalysis).toBeTruthy();
      expect(report?.aiAnalysis?.summary).toBe("Updated analysis");
    });
  });

  describe("getReportHistory", () => {
    it("should get report history for a branch", async () => {
      const overview: ProjectOverview = {
        totalFiles: 40,
        totalSymbols: 200,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 25,
          interfaces: 20,
          functions: 80,
          variables: 45,
          types: 15,
          enums: 8,
          modules: 7,
        },
      };

      // Save multiple reports
      for (let i = 0; i < 5; i++) {
        await db.saveReport("main", `commit${i}`, overview);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const history = await db.getReportHistory("main", 3);

      expect(history).toHaveLength(3);
      expect(history[0].commitHash).toBe("commit4"); // Most recent
      expect(history[2].commitHash).toBe("commit2"); // Third most recent
    });
  });

  describe("cacheAnalysis", () => {
    it("should cache and retrieve AI analysis", async () => {
      const analysis: AIAnalysis = {
        summary: "Cached analysis",
        architecture: "Hexagonal",
        keyComponents: [],
        codeQuality: {
          maintainability: 80,
          documentationLevel: "good",
          codeConsistency: "medium",
          architectureAdherence: "moderate",
        },
        suggestions: ["Improve documentation"],
        timestamp: new Date().toISOString(),
      };

      const contentHash = "hash123abc";
      await db.cacheAnalysis(contentHash, analysis, "gpt-4");

      const cached = await db.getCachedAnalysis(contentHash);

      expect(cached).toBeTruthy();
      expect(cached?.summary).toBe("Cached analysis");
    });

    it("should return null for non-existent cache", async () => {
      const cached = await db.getCachedAnalysis("non-existent-hash");
      expect(cached).toBeNull();
    });
  });

  describe("getStatistics", () => {
    it("should get database statistics", async () => {
      const overview: ProjectOverview = {
        totalFiles: 50,
        totalSymbols: 250,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 30,
          interfaces: 25,
          functions: 100,
          variables: 55,
          types: 20,
          enums: 10,
          modules: 10,
        },
      };

      // Save reports on different branches
      await db.saveReport("main", "commit1", overview);
      await db.saveReport("develop", "commit2", overview);
      await db.saveReport("main", "commit3", overview);

      const stats = await db.getStatistics();

      expect(stats.totalReports).toBe(3);
      expect(stats.branches).toBe(2);
      expect(stats.oldestReport).toBeTruthy();
      expect(stats.newestReport).toBeTruthy();
    });
  });

  describe("pruneOldReports", () => {
    it("should delete old reports", async () => {
      const overview: ProjectOverview = {
        totalFiles: 60,
        totalSymbols: 300,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 35,
          interfaces: 30,
          functions: 120,
          variables: 65,
          types: 25,
          enums: 12,
          modules: 13,
        },
      };

      // Save a report
      await db.saveReport("main", "old-commit", overview);

      // Prune with 0 days to keep (should delete all)
      const deleted = await db.pruneOldReports(0);

      expect(deleted).toBeGreaterThan(0);

      const report = await db.getReportByCommit("old-commit");
      expect(report).toBeNull();
    });
  });

  describe("getBranchesWithReports", () => {
    it("should get list of branches with reports", async () => {
      const overview: ProjectOverview = {
        totalFiles: 70,
        totalSymbols: 350,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 40,
          interfaces: 35,
          functions: 140,
          variables: 75,
          types: 30,
          enums: 15,
          modules: 15,
        },
      };

      await db.saveReport("main", "commit1", overview);
      await db.saveReport("develop", "commit2", overview);
      await db.saveReport("feature/test", "commit3", overview);
      await db.saveReport("main", "commit4", overview);

      const branches = await db.getBranchesWithReports();

      expect(branches).toHaveLength(3);
      expect(branches).toContain("main");
      expect(branches).toContain("develop");
      expect(branches).toContain("feature/test");
    });
  });

  describe("getReportsByDateRange", () => {
    it("should get reports within date range", async () => {
      const overview: ProjectOverview = {
        totalFiles: 80,
        totalSymbols: 400,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 45,
          interfaces: 40,
          functions: 160,
          variables: 85,
          types: 35,
          enums: 18,
          modules: 17,
        },
      };

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await db.saveReport("main", "commit-today", overview);

      const reports = await db.getReportsByDateRange(
        yesterday.toISOString(),
        tomorrow.toISOString(),
      );

      expect(reports).toHaveLength(1);
      expect(reports[0].commitHash).toBe("commit-today");
    });

    it("should filter by branch in date range", async () => {
      const overview: ProjectOverview = {
        totalFiles: 90,
        totalSymbols: 450,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 50,
          interfaces: 45,
          functions: 180,
          variables: 95,
          types: 40,
          enums: 20,
          modules: 20,
        },
      };

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await db.saveReport("main", "commit-main", overview);
      await db.saveReport("develop", "commit-develop", overview);

      const reports = await db.getReportsByDateRange(
        yesterday.toISOString(),
        tomorrow.toISOString(),
        "main",
      );

      expect(reports).toHaveLength(1);
      expect(reports[0].branch).toBe("main");
    });
  });
});
