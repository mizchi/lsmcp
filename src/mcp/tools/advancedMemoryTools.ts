/**
 * MCP tools for advanced memory database operations
 */

import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import { ReportManager } from "../../memory/database/reportManager.ts";
import { MemoryDatabase } from "../../memory/database/memoryDatabase.ts";
import { resolve } from "path";
import type { LSMCPConfig } from "../../config/schema/configSchema.ts";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Check if advanced memory features are enabled
 */
function isMemoryAdvancedEnabled(rootPath: string): boolean {
  const configPath = join(rootPath, ".lsmcp", "config.json");

  if (!existsSync(configPath)) {
    return false;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as LSMCPConfig;
    return config.memoryAdvanced === true;
  } catch {
    return false;
  }
}

/**
 * Generate and store a project report
 */
export const generateReportToolDef: ToolDef<any> = {
  name: "generate_report",
  description: `Generate a comprehensive project report and store it in the memory database.
Includes mechanical project overview and optionally AI analysis.
Requires memory_advanced: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    includeAIAnalysis: z
      .boolean()
      .optional()
      .describe("Include AI-generated analysis (requires AI prompt)"),
    aiPrompt: z.string().optional().describe("Custom prompt for AI analysis"),
  }),
  execute: async (args) => {
    const rootPath = resolve(args.root);

    // Check if advanced memory is enabled
    if (!isMemoryAdvancedEnabled(rootPath)) {
      throw new Error(
        "Advanced memory features are not enabled. Set memory_advanced: true in .lsmcp/config.json",
      );
    }

    const manager = new ReportManager(rootPath);

    try {
      const reportId = await manager.generateReport(
        args.includeAIAnalysis || false,
        args.aiPrompt,
      );

      const report = await manager.getLatestReport();

      return JSON.stringify(
        {
          success: true,
          reportId,
          branch: report?.branch,
          commitHash: report?.commitHash,
          timestamp: report?.timestamp,
          overview: {
            totalFiles: report?.overview.totalFiles,
            totalSymbols: report?.overview.totalSymbols,
            languages: report?.overview.languages?.slice(0, 5),
          },
          hasAIAnalysis: !!report?.aiAnalysis,
        },
        null,
        2,
      );
    } finally {
      manager.close();
    }
  },
};

/**
 * Get the latest report for the current branch
 */
export const getLatestReportToolDef: ToolDef<any> = {
  name: "get_latest_report",
  description: `Get the latest project report for the current branch.
Requires memory_advanced: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    includeFullOverview: z
      .boolean()
      .optional()
      .describe("Include full project overview details"),
    includeAIAnalysis: z
      .boolean()
      .optional()
      .describe("Include AI analysis if available"),
  }),
  execute: async (args) => {
    const rootPath = resolve(args.root);

    if (!isMemoryAdvancedEnabled(rootPath)) {
      throw new Error(
        "Advanced memory features are not enabled. Set memory_advanced: true in .lsmcp/config.json",
      );
    }

    const manager = new ReportManager(rootPath);

    try {
      const report = await manager.getLatestReport();

      if (!report) {
        return JSON.stringify({ error: "No reports found for current branch" });
      }

      const result: any = {
        id: report.id,
        branch: report.branch,
        commitHash: report.commitHash,
        timestamp: report.timestamp,
      };

      if (args.includeFullOverview) {
        result.overview = report.overview;
      } else {
        result.overviewSummary = {
          totalFiles: report.overview.totalFiles,
          totalSymbols: report.overview.totalSymbols,
          topLanguages: report.overview.languages?.slice(0, 3),
        };
      }

      if (args.includeAIAnalysis && report.aiAnalysis) {
        result.aiAnalysis = report.aiAnalysis;
      }

      return JSON.stringify(result, null, 2);
    } finally {
      manager.close();
    }
  },
};

/**
 * Get report history for the current branch
 */
export const getReportHistoryToolDef: ToolDef<any> = {
  name: "get_report_history",
  description: `Get the history of project reports for the current branch.
Requires memory_advanced: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of reports to return (default: 10)"),
  }),
  execute: async (args) => {
    const rootPath = resolve(args.root);

    if (!isMemoryAdvancedEnabled(rootPath)) {
      throw new Error(
        "Advanced memory features are not enabled. Set memory_advanced: true in .lsmcp/config.json",
      );
    }

    const manager = new ReportManager(rootPath);

    try {
      const reports = await manager.getHistory(args.limit || 10);

      const summaries = reports.map((report) => ({
        id: report.id,
        commitHash: report.commitHash.substring(0, 8),
        timestamp: report.timestamp,
        totalFiles: report.overview.totalFiles,
        totalSymbols: report.overview.totalSymbols,
        hasAIAnalysis: !!report.aiAnalysis,
      }));

      return JSON.stringify(
        {
          branch: reports[0]?.branch || "unknown",
          count: summaries.length,
          reports: summaries,
        },
        null,
        2,
      );
    } finally {
      manager.close();
    }
  },
};

/**
 * Update AI analysis for an existing report
 */
export const updateAIAnalysisToolDef: ToolDef<any> = {
  name: "update_ai_analysis",
  description: `Update or add AI analysis to an existing report.
Requires memory_advanced: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    reportId: z.string().describe("ID of the report to update"),
    analysis: z.object({
      summary: z.string().describe("Executive summary of the project"),
      architecture: z.string().describe("Description of the architecture"),
      keyComponents: z
        .array(
          z.object({
            name: z.string(),
            purpose: z.string(),
            dependencies: z.array(z.string()),
            complexity: z.enum(["low", "medium", "high"]),
            notes: z.string().optional(),
          }),
        )
        .describe("Analysis of key components"),
      codeQuality: z.object({
        maintainability: z.number().min(0).max(100),
        testCoverage: z.number().min(0).max(100).optional(),
        documentationLevel: z.enum(["poor", "basic", "good", "excellent"]),
        codeConsistency: z.enum(["low", "medium", "high"]),
        architectureAdherence: z.enum(["weak", "moderate", "strong"]),
      }),
      suggestions: z.array(z.string()).describe("Improvement suggestions"),
      technicalDebt: z.array(z.string()).optional(),
      securityConsiderations: z.array(z.string()).optional(),
      performanceNotes: z.array(z.string()).optional(),
    }),
  }),
  execute: async (args) => {
    const rootPath = resolve(args.root);

    if (!isMemoryAdvancedEnabled(rootPath)) {
      throw new Error(
        "Advanced memory features are not enabled. Set memory_advanced: true in .lsmcp/config.json",
      );
    }

    const db = new MemoryDatabase(rootPath);

    try {
      const aiAnalysis = {
        ...args.analysis,
        timestamp: new Date().toISOString(),
        model: "user-provided",
      };

      await db.updateAIAnalysis(args.reportId, aiAnalysis);

      return JSON.stringify({
        success: true,
        reportId: args.reportId,
        message: "AI analysis updated successfully",
      });
    } finally {
      db.close();
    }
  },
};

/**
 * Get report by commit hash
 */
export const getReportByCommitToolDef: ToolDef<any> = {
  name: "get_report_by_commit",
  description: `Get a project report for a specific commit hash.
Requires memory_advanced: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    commitHash: z.string().describe("Git commit hash (full or partial)"),
    includeFullDetails: z
      .boolean()
      .optional()
      .describe("Include full report details"),
  }),
  execute: async (args) => {
    const rootPath = resolve(args.root);

    if (!isMemoryAdvancedEnabled(rootPath)) {
      throw new Error(
        "Advanced memory features are not enabled. Set memory_advanced: true in .lsmcp/config.json",
      );
    }

    const db = new MemoryDatabase(rootPath);

    try {
      const report = await db.getReportByCommit(args.commitHash);

      if (!report) {
        return JSON.stringify({
          error: `No report found for commit ${args.commitHash}`,
        });
      }

      if (args.includeFullDetails) {
        return JSON.stringify(report, null, 2);
      }

      return JSON.stringify(
        {
          id: report.id,
          branch: report.branch,
          commitHash: report.commitHash,
          timestamp: report.timestamp,
          overviewSummary: {
            totalFiles: report.overview.totalFiles,
            totalSymbols: report.overview.totalSymbols,
            topLanguages: report.overview.languages?.slice(0, 3),
          },
          hasAIAnalysis: !!report.aiAnalysis,
        },
        null,
        2,
      );
    } finally {
      db.close();
    }
  },
};

/**
 * Get memory database statistics
 */
export const getMemoryStatsToolDef: ToolDef<any> = {
  name: "get_memory_stats",
  description: `Get statistics about the memory database.
Requires memory_advanced: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
  }),
  execute: async (args) => {
    const rootPath = resolve(args.root);

    if (!isMemoryAdvancedEnabled(rootPath)) {
      throw new Error(
        "Advanced memory features are not enabled. Set memory_advanced: true in .lsmcp/config.json",
      );
    }

    const manager = new ReportManager(rootPath);

    try {
      const stats = await manager.getStatistics();

      return JSON.stringify(
        {
          ...stats,
          databasePath: join(rootPath, ".lsmcp", "cache", "memory.db"),
          isEnabled: true,
        },
        null,
        2,
      );
    } finally {
      manager.close();
    }
  },
};

/**
 * Search reports by date range
 */
export const searchReportsByDateToolDef: ToolDef<any> = {
  name: "search_reports_by_date",
  description: `Search project reports within a date range.
Requires memory_advanced: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    startDate: z.string().describe("Start date (ISO format or YYYY-MM-DD)"),
    endDate: z.string().describe("End date (ISO format or YYYY-MM-DD)"),
    branch: z.string().optional().describe("Filter by specific branch"),
  }),
  execute: async (args) => {
    const rootPath = resolve(args.root);

    if (!isMemoryAdvancedEnabled(rootPath)) {
      throw new Error(
        "Advanced memory features are not enabled. Set memory_advanced: true in .lsmcp/config.json",
      );
    }

    const db = new MemoryDatabase(rootPath);

    try {
      const reports = await db.getReportsByDateRange(
        args.startDate,
        args.endDate,
        args.branch,
      );

      const summaries = reports.map((report) => ({
        id: report.id,
        branch: report.branch,
        commitHash: report.commitHash.substring(0, 8),
        timestamp: report.timestamp,
        totalFiles: report.overview.totalFiles,
        totalSymbols: report.overview.totalSymbols,
        hasAIAnalysis: !!report.aiAnalysis,
      }));

      return JSON.stringify(
        {
          dateRange: {
            start: args.startDate,
            end: args.endDate,
          },
          branch: args.branch || "all",
          count: summaries.length,
          reports: summaries,
        },
        null,
        2,
      );
    } finally {
      db.close();
    }
  },
};

/**
 * Get all advanced memory tools
 */
export function getAdvancedMemoryTools(): ToolDef<any>[] {
  return [
    generateReportToolDef,
    getLatestReportToolDef,
    getReportHistoryToolDef,
    updateAIAnalysisToolDef,
    getReportByCommitToolDef,
    getMemoryStatsToolDef,
    searchReportsByDateToolDef,
  ];
}

/**
 * Get advanced memory tools if enabled
 */
export function getAdvancedMemoryToolsIfEnabled(config?: {
  memoryAdvanced?: boolean;
}): ToolDef<any>[] {
  if (config?.memoryAdvanced) {
    return getAdvancedMemoryTools();
  }
  return [];
}
