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

      const reportId = await db.saveReport(
        "Test Report Title",
        "This is a test summary",
        "main",
        "abc123def456",
        overview,
      );

      expect(reportId).toBeTruthy();
      expect(typeof reportId).toBe("string");

      // Verify the report was saved with title and summary
      const report = await db.getReportByCommit("abc123def456");
      expect(report?.title).toBe("Test Report Title");
      expect(report?.summary).toBe("This is a test summary");
    });

    it("should prevent duplicate reports for the same commit", async () => {
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

      // Save first report
      await db.saveReport(
        "First Report",
        "First summary",
        "main",
        "duplicate-test-commit",
        overview,
      );

      // Try to save duplicate report
      await expect(
        db.saveReport(
          "Second Report",
          "Second summary",
          "main",
          "duplicate-test-commit",
          overview,
        ),
      ).rejects.toThrow(
        "Report already exists for commit duplicate-test-commit",
      );
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
        "AI Analysis Report",
        "Report with AI-generated analysis",
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
      await db.saveReport(
        "Report 1",
        "First report summary",
        "main",
        "commit1",
        overview,
      );
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      const latestId = await db.saveReport(
        "Report 2",
        "Second report summary",
        "main",
        "commit2",
        overview,
      );

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

      await db.saveReport(
        "Develop Report",
        "Report for develop branch",
        "develop",
        "unique-commit-hash",
        overview,
      );

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

      const reportId = await db.saveReport(
        "Main Report",
        "Report for main branch",
        "main",
        "commit123",
        overview,
      );

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
        await db.saveReport(
          `Report ${i}`,
          `Summary for report ${i}`,
          "main",
          `commit${i}`,
          overview,
        );
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
      await db.saveReport(
        "Main Report 1",
        "First main report",
        "main",
        "commit1",
        overview,
      );
      await db.saveReport(
        "Develop Report",
        "Develop branch report",
        "develop",
        "commit2",
        overview,
      );
      await db.saveReport(
        "Main Report 2",
        "Second main report",
        "main",
        "commit3",
        overview,
      );

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
      await db.saveReport(
        "Old Report",
        "Report to be pruned",
        "main",
        "old-commit",
        overview,
      );

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

      await db.saveReport(
        "Main Report 1",
        "First main branch report",
        "main",
        "commit1",
        overview,
      );
      await db.saveReport(
        "Develop Report",
        "Develop branch report",
        "develop",
        "commit2",
        overview,
      );
      await db.saveReport(
        "Feature Report",
        "Feature branch report",
        "feature/test",
        "commit3",
        overview,
      );
      await db.saveReport(
        "Main Report 2",
        "Second main branch report",
        "main",
        "commit4",
        overview,
      );

      const branches = await db.getBranchesWithReports();

      expect(branches).toHaveLength(3);
      expect(branches).toContain("main");
      expect(branches).toContain("develop");
      expect(branches).toContain("feature/test");
    });
  });

  describe("getAllReports", () => {
    it("should get all reports with pagination", async () => {
      const overview: ProjectOverview = {
        totalFiles: 100,
        totalSymbols: 500,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 50,
          interfaces: 45,
          functions: 200,
          variables: 100,
          types: 50,
          enums: 25,
          modules: 30,
        },
      };

      // Save multiple reports
      for (let i = 0; i < 15; i++) {
        await db.saveReport(
          `Report ${i}`,
          `Summary for report ${i}`,
          "main",
          `commit${i}`,
          overview,
        );
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Get first page
      const page1 = await db.getAllReports({ limit: 10, offset: 0 });
      expect(page1.total).toBe(15);
      expect(page1.reports).toHaveLength(10);

      // Get second page
      const page2 = await db.getAllReports({ limit: 10, offset: 10 });
      expect(page2.total).toBe(15);
      expect(page2.reports).toHaveLength(5);
    });

    it("should filter by branch", async () => {
      const overview: ProjectOverview = {
        totalFiles: 50,
        totalSymbols: 250,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 25,
          interfaces: 20,
          functions: 100,
          variables: 50,
          types: 25,
          enums: 15,
          modules: 15,
        },
      };

      await db.saveReport(
        "Main Report 1",
        "First main report",
        "main",
        "commit1",
        overview,
      );
      await db.saveReport(
        "Develop Report",
        "Develop branch report",
        "develop",
        "commit2",
        overview,
      );
      await db.saveReport(
        "Main Report 2",
        "Second main report",
        "main",
        "commit3",
        overview,
      );

      const result = await db.getAllReports({ branch: "main" });
      expect(result.total).toBe(2);
      expect(result.reports.every((r) => r.branch === "main")).toBe(true);
    });

    it("should sort reports", async () => {
      const overview: ProjectOverview = {
        totalFiles: 30,
        totalSymbols: 150,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 15,
          interfaces: 10,
          functions: 60,
          variables: 30,
          types: 15,
          enums: 10,
          modules: 10,
        },
      };

      await db.saveReport(
        "Report A",
        "Branch A report",
        "branch-a",
        "zzz",
        overview,
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      await db.saveReport(
        "Report B",
        "Branch B report",
        "branch-b",
        "aaa",
        overview,
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      await db.saveReport(
        "Report C",
        "Branch C report",
        "branch-c",
        "mmm",
        overview,
      );

      // Sort by branch ascending
      const result = await db.getAllReports({
        sortBy: "branch",
        sortOrder: "asc",
      });

      expect(result.reports[0].branch).toBe("branch-a");
      expect(result.reports[1].branch).toBe("branch-b");
      expect(result.reports[2].branch).toBe("branch-c");
    });
  });

  describe("getReportDetails", () => {
    it("should get full report details", async () => {
      const overview: ProjectOverview = {
        totalFiles: 75,
        totalSymbols: 375,
        languages: [
          { language: "TypeScript", files: 60, lines: 7500, percentage: 80 },
          { language: "JavaScript", files: 15, lines: 1875, percentage: 20 },
        ],
        structure: { name: "test", type: "directory" },
        dependencies: [{ name: "express", version: "4.18.0", type: "runtime" }],
        symbolBreakdown: {
          classes: 35,
          interfaces: 30,
          functions: 150,
          variables: 75,
          types: 40,
          enums: 20,
          modules: 25,
        },
      };

      const aiAnalysis: AIAnalysis = {
        summary: "Well-structured TypeScript project",
        architecture: "MVC pattern",
        keyComponents: [],
        codeQuality: {
          maintainability: 85,
          documentationLevel: "good",
          codeConsistency: "high",
          architectureAdherence: "strong",
        },
        suggestions: [],
        timestamp: new Date().toISOString(),
      };

      const reportId = await db.saveReport(
        "Detailed Report",
        "Full report with all details",
        "main",
        "detail-test",
        overview,
        aiAnalysis,
      );

      const details = await db.getReportDetails(reportId);

      expect(details).toBeTruthy();
      expect(details?.id).toBe(reportId);
      expect(details?.overview.totalFiles).toBe(75);
      expect(details?.overview.languages).toHaveLength(2);
      expect(details?.overview.dependencies).toHaveLength(1);
      expect(details?.aiAnalysis?.summary).toBe(
        "Well-structured TypeScript project",
      );
    });

    it("should return null for non-existent report", async () => {
      const details = await db.getReportDetails("non-existent-id");
      expect(details).toBeNull();
    });
  });

  describe("searchReportsByKeyword", () => {
    it("should find reports by keyword in overview", async () => {
      const overview1: ProjectOverview = {
        totalFiles: 100,
        totalSymbols: 500,
        languages: [
          { language: "TypeScript", files: 80, lines: 10000, percentage: 80 },
        ],
        structure: { name: "test", type: "directory" },
        dependencies: [{ name: "react", version: "18.2.0", type: "runtime" }],
        symbolBreakdown: {
          classes: 50,
          interfaces: 40,
          functions: 200,
          variables: 100,
          types: 60,
          enums: 25,
          modules: 25,
        },
      };

      const overview2: ProjectOverview = {
        totalFiles: 50,
        totalSymbols: 250,
        languages: [
          { language: "Python", files: 50, lines: 5000, percentage: 100 },
        ],
        structure: { name: "test", type: "directory" },
        dependencies: [{ name: "django", version: "4.2.0", type: "runtime" }],
        symbolBreakdown: {
          classes: 25,
          interfaces: 0,
          functions: 100,
          variables: 75,
          types: 0,
          enums: 0,
          modules: 50,
        },
      };

      await db.saveReport(
        "TypeScript Report",
        "Report with React dependency",
        "main",
        "commit1",
        overview1,
      );
      await db.saveReport(
        "Python Report",
        "Report with Django dependency",
        "main",
        "commit2",
        overview2,
      );

      // Search for "react"
      const reactResults = await db.searchReportsByKeyword("react");
      expect(reactResults).toHaveLength(1);
      expect(reactResults[0].commitHash).toBe("commit1");

      // Search for "TypeScript"
      const tsResults = await db.searchReportsByKeyword("TypeScript");
      expect(tsResults).toHaveLength(1);
      expect(tsResults[0].commitHash).toBe("commit1");
    });

    it("should find reports by keyword in AI analysis", async () => {
      const overview: ProjectOverview = {
        totalFiles: 60,
        totalSymbols: 300,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 30,
          interfaces: 25,
          functions: 120,
          variables: 60,
          types: 30,
          enums: 15,
          modules: 20,
        },
      };

      const aiAnalysis1: AIAnalysis = {
        summary: "Project uses microservices architecture",
        architecture: "Microservices",
        keyComponents: [],
        codeQuality: {
          maintainability: 80,
          documentationLevel: "good",
          codeConsistency: "high",
          architectureAdherence: "strong",
        },
        suggestions: [],
        timestamp: new Date().toISOString(),
      };

      const aiAnalysis2: AIAnalysis = {
        summary: "Monolithic application with clean architecture",
        architecture: "Monolithic",
        keyComponents: [],
        codeQuality: {
          maintainability: 85,
          documentationLevel: "excellent",
          codeConsistency: "high",
          architectureAdherence: "strong",
        },
        suggestions: [],
        timestamp: new Date().toISOString(),
      };

      await db.saveReport(
        "Microservices Report",
        "Report with microservices architecture",
        "main",
        "commit1",
        overview,
        aiAnalysis1,
      );
      await db.saveReport(
        "Monolithic Report",
        "Report with monolithic architecture",
        "main",
        "commit2",
        overview,
        aiAnalysis2,
      );

      // Search for "microservices"
      const results = await db.searchReportsByKeyword("microservices");
      expect(results).toHaveLength(1);
      expect(results[0].commitHash).toBe("commit1");
    });

    it("should respect search options", async () => {
      const overview: ProjectOverview = {
        totalFiles: 40,
        totalSymbols: 200,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 20,
          interfaces: 15,
          functions: 80,
          variables: 40,
          types: 20,
          enums: 10,
          modules: 15,
        },
      };

      // Save reports on different branches
      for (let i = 0; i < 5; i++) {
        await db.saveReport(
          `Main Report ${i}`,
          `Main branch report ${i}`,
          "main",
          `main-${i}`,
          overview,
        );
        await db.saveReport(
          `Dev Report ${i}`,
          `Develop branch report ${i}`,
          "develop",
          `dev-${i}`,
          overview,
        );
      }

      // Search with branch filter
      const results = await db.searchReportsByKeyword("test", {
        branch: "main",
        limit: 3,
      });

      expect(results.length).toBeLessThanOrEqual(3);
      expect(results.every((r) => r.branch === "main")).toBe(true);
    });
  });

  describe("deprecated functionality", () => {
    it("should deprecate a report", async () => {
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

      const reportId = await db.saveReport(
        "Report to Deprecate",
        "This report will be deprecated",
        "main",
        "dep-commit",
        overview,
      );

      await db.deprecateReport(reportId, "Outdated information");

      const report = await db.getReportByCommit("dep-commit");
      expect(report?.deprecated).toBe(true);
      expect(report?.deprecatedReason).toBe("Outdated information");
      expect(report?.deprecatedAt).toBeTruthy();
    });

    it("should undeprecate a report", async () => {
      const overview: ProjectOverview = {
        totalFiles: 20,
        totalSymbols: 100,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 10,
          interfaces: 5,
          functions: 40,
          variables: 25,
          types: 10,
          enums: 5,
          modules: 5,
        },
      };

      const reportId = await db.saveReport(
        "Report to Undeprecate",
        "This report will be undeprecated",
        "main",
        "undep-commit",
        overview,
      );

      await db.deprecateReport(reportId, "Mistake");
      await db.undeprecateReport(reportId);

      const report = await db.getReportByCommit("undep-commit");
      expect(report?.deprecated).toBe(false);
      expect(report?.deprecatedReason).toBeUndefined();
      expect(report?.deprecatedAt).toBeUndefined();
    });

    it("should exclude deprecated reports by default", async () => {
      const overview: ProjectOverview = {
        totalFiles: 30,
        totalSymbols: 150,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 15,
          interfaces: 10,
          functions: 60,
          variables: 35,
          types: 15,
          enums: 10,
          modules: 5,
        },
      };

      // Save active and deprecated reports
      const activeId = await db.saveReport(
        "Active Report",
        "Active report",
        "main",
        "active-commit",
        overview,
      );

      const deprecatedId = await db.saveReport(
        "Deprecated Report",
        "Deprecated report",
        "main",
        "deprecated-commit",
        overview,
      );

      await db.deprecateReport(deprecatedId, "Test deprecation");

      // Get latest report should return active one
      const latest = await db.getLatestReport("main", false);
      expect(latest?.id).toBe(activeId);

      // Get history without deprecated
      const history = await db.getReportHistory("main", 10, false);
      expect(history.some((r) => r.id === activeId)).toBe(true);
      expect(history.some((r) => r.id === deprecatedId)).toBe(false);

      // Get history with deprecated
      const historyWithDeprecated = await db.getReportHistory("main", 10, true);
      expect(historyWithDeprecated.some((r) => r.id === activeId)).toBe(true);
      expect(historyWithDeprecated.some((r) => r.id === deprecatedId)).toBe(
        true,
      );
    });

    it("should filter deprecated reports in searches", async () => {
      const overview: ProjectOverview = {
        totalFiles: 40,
        totalSymbols: 200,
        languages: [
          { language: "TypeScript", files: 40, lines: 4000, percentage: 100 },
        ],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 20,
          interfaces: 15,
          functions: 80,
          variables: 45,
          types: 20,
          enums: 10,
          modules: 10,
        },
      };

      await db.saveReport(
        "Active TypeScript Report",
        "Active TS report",
        "main",
        "active-ts",
        overview,
      );

      const deprecatedId = await db.saveReport(
        "Deprecated TypeScript Report",
        "Deprecated TS report",
        "main",
        "deprecated-ts",
        overview,
      );

      await db.deprecateReport(deprecatedId, "Old version");

      // Search without deprecated
      const results = await db.searchReportsByKeyword("TypeScript", {
        withDeprecated: false,
      });
      expect(results).toHaveLength(1);
      expect(results[0].commitHash).toBe("active-ts");

      // Search with deprecated
      const resultsWithDeprecated = await db.searchReportsByKeyword(
        "TypeScript",
        {
          withDeprecated: true,
        },
      );
      expect(resultsWithDeprecated).toHaveLength(2);
    });

    it("should get deprecated reports list", async () => {
      const overview: ProjectOverview = {
        totalFiles: 50,
        totalSymbols: 250,
        languages: [],
        structure: { name: "test", type: "directory" },
        symbolBreakdown: {
          classes: 25,
          interfaces: 20,
          functions: 100,
          variables: 55,
          types: 25,
          enums: 15,
          modules: 10,
        },
      };

      const ids = [];
      for (let i = 0; i < 3; i++) {
        const id = await db.saveReport(
          `Deprecated Report ${i}`,
          `Summary ${i}`,
          "main",
          `dep-${i}`,
          overview,
        );
        await db.deprecateReport(id, `Reason ${i}`);
        ids.push(id);
      }

      const deprecatedReports = await db.getDeprecatedReports(10);
      expect(deprecatedReports).toHaveLength(3);
      expect(deprecatedReports.every((r) => r.deprecated === true)).toBe(true);
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

      await db.saveReport(
        "Today's Report",
        "Report created today",
        "main",
        "commit-today",
        overview,
      );

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

      await db.saveReport(
        "Main Branch Report",
        "Report for main branch",
        "main",
        "commit-main",
        overview,
      );
      await db.saveReport(
        "Develop Branch Report",
        "Report for develop branch",
        "develop",
        "commit-develop",
        overview,
      );

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
