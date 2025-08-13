/**
 * MCP tools for advanced memory database operations
 */

import { z } from "zod";
import type { McpToolDef } from "@lsmcp/types";
import { ReportManager } from "../../features/memory/database/reportManager.ts";
import { MemoryDatabase } from "../../features/memory/database/memoryDatabase.ts";
import { resolve } from "path";
import type { LSMCPConfig } from "../../config/schema.ts";
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
    // Support both old memoryAdvanced and new experiments.memory
    return (
      config.experiments?.memory === true || config.memoryAdvanced === true
    );
  } catch {
    return false;
  }
}

/**
 * Generate and store a project report
 */
export const generateReportToolDef: McpToolDef<any> = {
  name: "generate_report",
  description: `Generate a comprehensive project report and store it in the memory database.
Includes mechanical project overview and optionally AI analysis.
Requires experiments.memory: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    title: z
      .string()
      .optional()
      .describe("Custom title for the report (auto-generated if not provided)"),
    summary: z
      .string()
      .optional()
      .describe(
        "Custom summary for the report (auto-generated if not provided)",
      ),
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
        args.title,
        args.summary,
        args.includeAIAnalysis || false,
        args.aiPrompt,
      );

      const report = await manager.getLatestReport();

      return JSON.stringify(
        {
          success: true,
          reportId,
          title: report?.title,
          summary: report?.summary,
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
export const getLatestReportToolDef: McpToolDef<any> = {
  name: "get_latest_report",
  description: `Get the latest project report for the current branch.
Requires experiments.memory: true in .lsmcp/config.json`,
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
    withDeprecated: z
      .boolean()
      .optional()
      .describe("Include deprecated reports (default: false)"),
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
      const report = await manager.getLatestReport(
        args.withDeprecated || false,
      );

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
export const getReportHistoryToolDef: McpToolDef<any> = {
  name: "get_report_history",
  description: `Get the history of project reports for the current branch.
Requires experiments.memory: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of reports to return (default: 10)"),
    withDeprecated: z
      .boolean()
      .optional()
      .describe("Include deprecated reports (default: false)"),
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
      const reports = await manager.getHistory(
        args.limit || 10,
        args.withDeprecated || false,
      );

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
export const updateAIAnalysisToolDef: McpToolDef<any> = {
  name: "update_ai_analysis",
  description: `Update or add AI analysis to an existing report.
Requires experiments.memory: true in .lsmcp/config.json`,
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
export const getReportByCommitToolDef: McpToolDef<any> = {
  name: "get_report_by_commit",
  description: `Get a project report for a specific commit hash.
Requires experiments.memory: true in .lsmcp/config.json`,
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
export const getMemoryStatsToolDef: McpToolDef<any> = {
  name: "get_memory_stats",
  description: `Get statistics about the memory database.
Requires experiments.memory: true in .lsmcp/config.json`,
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
export const searchReportsByDateToolDef: McpToolDef<any> = {
  name: "search_reports_by_date",
  description: `Search project reports within a date range.
Requires experiments.memory: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    startDate: z.string().describe("Start date (ISO format or YYYY-MM-DD)"),
    endDate: z.string().describe("End date (ISO format or YYYY-MM-DD)"),
    branch: z.string().optional().describe("Filter by specific branch"),
    withDeprecated: z
      .boolean()
      .optional()
      .describe("Include deprecated reports (default: false)"),
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
        args.withDeprecated || false,
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
 * Get all reports with pagination and filters
 */
export const getAllReportsToolDef: McpToolDef<any> = {
  name: "get_all_reports",
  description: `Get all project reports with pagination and optional filters.
Supports sorting and filtering by branch.
By default, deprecated reports are excluded.
Requires experiments.memory: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of reports per page (default: 50)"),
    offset: z
      .number()
      .min(0)
      .optional()
      .describe("Number of reports to skip (for pagination)"),
    branch: z.string().optional().describe("Filter by specific branch"),
    sortBy: z
      .enum(["timestamp", "commit_hash", "branch"])
      .optional()
      .describe("Sort field (default: timestamp)"),
    sortOrder: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort order (default: desc)"),
    withDeprecated: z
      .boolean()
      .optional()
      .describe("Include deprecated reports (default: false)"),
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
      const result = await manager.getAllReports({
        limit: args.limit,
        offset: args.offset,
        branch: args.branch,
        sortBy: args.sortBy,
        sortOrder: args.sortOrder,
        withDeprecated: args.withDeprecated,
      });

      const summaries = result.reports.map((report) => ({
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
          total: result.total,
          page: Math.floor((args.offset || 0) / (args.limit || 50)) + 1,
          pageSize: args.limit || 50,
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
 * Get detailed report information
 */
export const getReportDetailsToolDef: McpToolDef<any> = {
  name: "get_report_details",
  description: `Get complete details of a specific project report.
Includes full overview and AI analysis if available.
Requires experiments.memory: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    reportId: z.string().describe("ID of the report to retrieve"),
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
      const report = await manager.getReportDetails(args.reportId);

      if (!report) {
        return JSON.stringify({
          error: `Report not found: ${args.reportId}`,
        });
      }

      return JSON.stringify(report, null, 2);
    } finally {
      manager.close();
    }
  },
};

/**
 * Search reports by keyword
 */
export const searchReportsByKeywordToolDef: McpToolDef<any> = {
  name: "search_reports_by_keyword",
  description: `Search project reports by keyword in overview or AI analysis.
Searches in file statistics, language information, dependencies, and AI analysis.
By default, deprecated reports are excluded.
Requires experiments.memory: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    keyword: z.string().describe("Keyword to search for"),
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum number of results (default: 20)"),
    branch: z.string().optional().describe("Filter by specific branch"),
    searchInAIAnalysis: z
      .boolean()
      .optional()
      .describe("Include AI analysis in search (default: true)"),
    withDeprecated: z
      .boolean()
      .optional()
      .describe("Include deprecated reports (default: false)"),
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
      const reports = await manager.searchReportsByKeyword(args.keyword, {
        limit: args.limit,
        branch: args.branch,
        searchInAIAnalysis: args.searchInAIAnalysis,
        withDeprecated: args.withDeprecated,
      });

      const results = reports.map((report) => ({
        id: report.id,
        branch: report.branch,
        commitHash: report.commitHash.substring(0, 8),
        timestamp: report.timestamp,
        relevantInfo: extractRelevantInfo(report, args.keyword),
        hasAIAnalysis: !!report.aiAnalysis,
      }));

      return JSON.stringify(
        {
          keyword: args.keyword,
          count: results.length,
          results,
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
 * Helper function to extract relevant information around keyword
 */
function extractRelevantInfo(
  report: any,
  keyword: string,
): { context: string; source: string } {
  const keywordLower = keyword.toLowerCase();

  // Check in overview
  const overviewStr = JSON.stringify(report.overview);
  if (overviewStr.toLowerCase().includes(keywordLower)) {
    // Try to find specific context
    if (report.overview.languages) {
      for (const lang of report.overview.languages) {
        if (lang.language.toLowerCase().includes(keywordLower)) {
          return {
            context: `${lang.language}: ${lang.files} files, ${lang.lines} lines`,
            source: "languages",
          };
        }
      }
    }

    if (report.overview.dependencies) {
      for (const dep of report.overview.dependencies) {
        if (dep.name.toLowerCase().includes(keywordLower)) {
          return {
            context: `${dep.name}@${dep.version} (${dep.type})`,
            source: "dependencies",
          };
        }
      }
    }

    return {
      context: `Files: ${report.overview.totalFiles}, Symbols: ${report.overview.totalSymbols}`,
      source: "overview",
    };
  }

  // Check in AI analysis
  if (report.aiAnalysis) {
    const aiStr = JSON.stringify(report.aiAnalysis);
    if (aiStr.toLowerCase().includes(keywordLower)) {
      if (
        report.aiAnalysis.summary &&
        report.aiAnalysis.summary.toLowerCase().includes(keywordLower)
      ) {
        return {
          context: report.aiAnalysis.summary.substring(0, 150) + "...",
          source: "ai_summary",
        };
      }

      return {
        context: "Found in AI analysis",
        source: "ai_analysis",
      };
    }
  }

  return {
    context: "Keyword found in metadata",
    source: "metadata",
  };
}

/**
 * Deprecate a report
 */
export const deprecateReportToolDef: McpToolDef<any> = {
  name: "deprecate_report",
  description: `Mark a report as deprecated.
Deprecated reports are excluded from normal searches unless explicitly included.
Requires experiments.memory: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    reportId: z.string().describe("ID of the report to deprecate"),
    reason: z.string().optional().describe("Reason for deprecation"),
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
      await manager.deprecateReport(args.reportId, args.reason);

      return JSON.stringify({
        success: true,
        reportId: args.reportId,
        message: "Report marked as deprecated",
        reason: args.reason || "No reason provided",
      });
    } finally {
      manager.close();
    }
  },
};

/**
 * Undeprecate a report
 */
export const undeprecateReportToolDef: McpToolDef<any> = {
  name: "undeprecate_report",
  description: `Remove deprecated status from a report.
Requires experiments.memory: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    reportId: z.string().describe("ID of the report to undeprecate"),
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
      await manager.undeprecateReport(args.reportId);

      return JSON.stringify({
        success: true,
        reportId: args.reportId,
        message: "Deprecated status removed from report",
      });
    } finally {
      manager.close();
    }
  },
};

/**
 * Get deprecated reports
 */
export const getDeprecatedReportsToolDef: McpToolDef<any> = {
  name: "get_deprecated_reports",
  description: `Get a list of deprecated reports.
Requires experiments.memory: true in .lsmcp/config.json`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of reports to return (default: 50)"),
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
      const reports = await manager.getDeprecatedReports(args.limit || 50);

      const summaries = reports.map((report) => ({
        id: report.id,
        title: report.title,
        summary: report.summary,
        branch: report.branch,
        commitHash: report.commitHash.substring(0, 8),
        timestamp: report.timestamp,
        deprecatedAt: report.deprecatedAt,
        deprecatedReason: report.deprecatedReason || "No reason provided",
      }));

      return JSON.stringify(
        {
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
 * Get all advanced memory tools
 */
export function getAdvancedMemoryTools(): McpToolDef<any>[] {
  return [
    generateReportToolDef,
    getLatestReportToolDef,
    getReportHistoryToolDef,
    getAllReportsToolDef,
    getReportDetailsToolDef,
    searchReportsByKeywordToolDef,
    updateAIAnalysisToolDef,
    getReportByCommitToolDef,
    getMemoryStatsToolDef,
    searchReportsByDateToolDef,
    deprecateReportToolDef,
    undeprecateReportToolDef,
    getDeprecatedReportsToolDef,
  ];
}

/**
 * Get advanced memory tools if enabled
 */
export function getAdvancedMemoryToolsIfEnabled(config?: {
  memoryAdvanced?: boolean;
  experiments?: {
    memory?: boolean;
  };
}): McpToolDef<any>[] {
  // Support both old memoryAdvanced and new experiments.memory
  const memoryEnabled = config?.experiments?.memory || config?.memoryAdvanced;
  if (memoryEnabled) {
    return getAdvancedMemoryTools();
  }
  return [];
}
