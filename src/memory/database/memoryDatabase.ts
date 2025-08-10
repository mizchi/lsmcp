/**
 * SQLite-based memory database for storing project reports and AI analysis
 */

import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import type { ReportRecord, ProjectOverview, AIAnalysis } from "./schema.ts";
import { CREATE_TABLES } from "./schema.ts";

export class MemoryDatabase {
  private db: Database.Database;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    const dbPath = this.getDatabasePath();

    // Ensure cache directory exists
    const cacheDir = join(projectPath, ".lsmcp", "cache");
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private getDatabasePath(): string {
    return join(this.projectPath, ".lsmcp", "cache", "memory.db");
  }

  private initializeTables(): void {
    this.db.exec(CREATE_TABLES);
  }

  /**
   * Check if a report already exists for a commit
   */
  async reportExistsForCommit(commitHash: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM reports 
      WHERE project_path = ? AND commit_hash = ?
    `);

    const result = stmt.get(this.projectPath, commitHash) as any;
    return result.count > 0;
  }

  /**
   * Save a new report to the database
   */
  async saveReport(
    title: string,
    summary: string,
    branch: string,
    commitHash: string,
    overview: ProjectOverview,
    aiAnalysis?: AIAnalysis,
    metadata?: Record<string, any>,
  ): Promise<string> {
    // Check if report already exists for this commit
    if (await this.reportExistsForCommit(commitHash)) {
      throw new Error(
        `Report already exists for commit ${commitHash}. Cannot overwrite existing reports.`,
      );
    }

    const id = uuidv4();
    const timestamp = new Date().toISOString();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO reports (
          id, project_path, title, summary, branch, commit_hash, 
          timestamp, overview, ai_analysis, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        this.projectPath,
        title,
        summary,
        branch,
        commitHash,
        timestamp,
        JSON.stringify(overview),
        aiAnalysis ? JSON.stringify(aiAnalysis) : null,
        metadata ? JSON.stringify(metadata) : null,
      );

      return id;
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new Error(
          `Report already exists for commit ${commitHash}. Cannot overwrite existing reports.`,
        );
      }
      throw error;
    }
  }

  /**
   * Update AI analysis for an existing report
   */
  async updateAIAnalysis(
    reportId: string,
    aiAnalysis: AIAnalysis,
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE reports 
      SET ai_analysis = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(JSON.stringify(aiAnalysis), reportId);
  }

  /**
   * Deprecate a report
   */
  async deprecateReport(reportId: string, reason?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE reports 
      SET deprecated = 1, 
          deprecated_at = ?,
          deprecated_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND project_path = ?
    `);

    stmt.run(
      new Date().toISOString(),
      reason || null,
      reportId,
      this.projectPath,
    );
  }

  /**
   * Undeprecate a report
   */
  async undeprecateReport(reportId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE reports 
      SET deprecated = 0, 
          deprecated_at = NULL,
          deprecated_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND project_path = ?
    `);

    stmt.run(reportId, this.projectPath);
  }

  /**
   * Get the latest report for a branch
   */
  async getLatestReport(
    branch: string,
    includeDeprecated: boolean = false,
  ): Promise<ReportRecord | null> {
    let query = `
      SELECT * FROM reports 
      WHERE project_path = ? AND branch = ?
    `;

    if (!includeDeprecated) {
      query += " AND (deprecated = 0 OR deprecated IS NULL)";
    }

    query += " ORDER BY timestamp DESC LIMIT 1";

    const stmt = this.db.prepare(query);
    const row = stmt.get(this.projectPath, branch) as any;
    if (!row) return null;

    return this.parseReportRow(row);
  }

  /**
   * Get report by commit hash
   */
  async getReportByCommit(commitHash: string): Promise<ReportRecord | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM reports 
      WHERE project_path = ? AND commit_hash = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    const row = stmt.get(this.projectPath, commitHash) as any;
    if (!row) return null;

    return this.parseReportRow(row);
  }

  /**
   * Get all reports for a branch
   */
  async getReportHistory(
    branch: string,
    limit: number = 10,
    includeDeprecated: boolean = false,
  ): Promise<ReportRecord[]> {
    let query = `
      SELECT * FROM reports 
      WHERE project_path = ? AND branch = ?
    `;

    if (!includeDeprecated) {
      query += " AND (deprecated = 0 OR deprecated IS NULL)";
    }

    query += " ORDER BY timestamp DESC LIMIT ?";

    const stmt = this.db.prepare(query);
    const rows = stmt.all(this.projectPath, branch, limit) as any[];
    return rows.map((row) => this.parseReportRow(row));
  }

  /**
   * Search reports by date range
   */
  async getReportsByDateRange(
    startDate: string,
    endDate: string,
    branch?: string,
    withDeprecated: boolean = false,
  ): Promise<ReportRecord[]> {
    let query = `
      SELECT * FROM reports 
      WHERE project_path = ? 
        AND timestamp >= ? 
        AND timestamp <= ?
    `;

    if (!withDeprecated) {
      query += " AND (deprecated = 0 OR deprecated IS NULL)";
    }

    const params: any[] = [this.projectPath, startDate, endDate];

    if (branch) {
      query += " AND branch = ?";
      params.push(branch);
    }

    query += " ORDER BY timestamp DESC";

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => this.parseReportRow(row));
  }

  /**
   * Get branches with reports
   */
  async getBranchesWithReports(): Promise<string[]> {
    const stmt = this.db.prepare(`
      SELECT DISTINCT branch FROM reports 
      WHERE project_path = ?
      ORDER BY branch
    `);

    const rows = stmt.all(this.projectPath) as any[];
    return rows.map((row) => row.branch);
  }

  /**
   * Get all reports with pagination and optional filters
   */
  async getAllReports(options?: {
    limit?: number;
    offset?: number;
    branch?: string;
    sortBy?: "timestamp" | "commit_hash" | "branch";
    sortOrder?: "asc" | "desc";
    withDeprecated?: boolean;
  }): Promise<{ reports: ReportRecord[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const sortBy = options?.sortBy || "timestamp";
    const sortOrder = options?.sortOrder || "desc";

    let countQuery = `SELECT COUNT(*) as total FROM reports WHERE project_path = ?`;
    let query = `SELECT * FROM reports WHERE project_path = ?`;
    const params: any[] = [this.projectPath];

    if (!options?.withDeprecated) {
      countQuery += " AND (deprecated = 0 OR deprecated IS NULL)";
      query += " AND (deprecated = 0 OR deprecated IS NULL)";
    }

    if (options?.branch) {
      countQuery += " AND branch = ?";
      query += " AND branch = ?";
      params.push(options.branch);
    }

    // Get total count
    const countStmt = this.db.prepare(countQuery);
    const countResult = countStmt.get(...params) as any;
    const total = countResult.total;

    // Add sorting and pagination
    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    const reports = rows.map((row) => this.parseReportRow(row));

    return { reports, total };
  }

  /**
   * Get full report details including all metadata
   */
  async getReportDetails(reportId: string): Promise<ReportRecord | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM reports 
      WHERE id = ? AND project_path = ?
    `);

    const row = stmt.get(reportId, this.projectPath) as any;
    if (!row) return null;

    return this.parseReportRow(row);
  }

  /**
   * Search reports by keyword in overview or AI analysis
   */
  async searchReportsByKeyword(
    keyword: string,
    options?: {
      limit?: number;
      branch?: string;
      searchInAIAnalysis?: boolean;
      withDeprecated?: boolean;
    },
  ): Promise<ReportRecord[]> {
    const limit = options?.limit || 20;
    let query = `
      SELECT * FROM reports 
      WHERE project_path = ? 
    `;

    if (!options?.withDeprecated) {
      query += " AND (deprecated = 0 OR deprecated IS NULL)";
    }

    query += " AND (overview LIKE ? OR metadata LIKE ?";

    const searchPattern = `%${keyword}%`;
    const params: any[] = [this.projectPath, searchPattern, searchPattern];

    if (options?.searchInAIAnalysis !== false) {
      query += " OR ai_analysis LIKE ?";
      params.push(searchPattern);
    }

    query += ")";

    if (options?.branch) {
      query += " AND branch = ?";
      params.push(options.branch);
    }

    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => this.parseReportRow(row));
  }

  /**
   * Cache AI analysis for reuse
   */
  async cacheAnalysis(
    contentHash: string,
    analysis: AIAnalysis,
    model?: string,
  ): Promise<void> {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO analysis_cache (
        id, project_path, content_hash, analysis, model
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      this.projectPath,
      contentHash,
      JSON.stringify(analysis),
      model || null,
    );
  }

  /**
   * Get cached analysis by content hash
   */
  async getCachedAnalysis(contentHash: string): Promise<AIAnalysis | null> {
    const stmt = this.db.prepare(`
      SELECT analysis FROM analysis_cache 
      WHERE project_path = ? AND content_hash = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = stmt.get(this.projectPath, contentHash) as any;
    if (!row) return null;

    return JSON.parse(row.analysis);
  }

  /**
   * Delete old reports
   */
  async pruneOldReports(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const stmt = this.db.prepare(`
      DELETE FROM reports 
      WHERE project_path = ? AND timestamp < ?
    `);

    const result = stmt.run(this.projectPath, cutoffDate.toISOString());
    return result.changes;
  }

  /**
   * Get deprecated reports
   */
  async getDeprecatedReports(limit: number = 50): Promise<ReportRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM reports 
      WHERE project_path = ? AND deprecated = 1
      ORDER BY deprecated_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(this.projectPath, limit) as any[];
    return rows.map((row) => this.parseReportRow(row));
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalReports: number;
    activeReports: number;
    deprecatedReports: number;
    branches: number;
    oldestReport?: string;
    newestReport?: string;
    cacheSize: number;
  }> {
    const totalStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM reports WHERE project_path = ?
    `);
    const total = (totalStmt.get(this.projectPath) as any).count;

    const activeStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM reports 
      WHERE project_path = ? AND (deprecated = 0 OR deprecated IS NULL)
    `);
    const active = (activeStmt.get(this.projectPath) as any).count;

    const deprecatedStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM reports 
      WHERE project_path = ? AND deprecated = 1
    `);
    const deprecated = (deprecatedStmt.get(this.projectPath) as any).count;

    const branchesStmt = this.db.prepare(`
      SELECT COUNT(DISTINCT branch) as count FROM reports WHERE project_path = ?
    `);
    const branches = (branchesStmt.get(this.projectPath) as any).count;

    const datesStmt = this.db.prepare(`
      SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest 
      FROM reports WHERE project_path = ?
    `);
    const dates = datesStmt.get(this.projectPath) as any;

    const cacheStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM analysis_cache WHERE project_path = ?
    `);
    const cacheSize = (cacheStmt.get(this.projectPath) as any).count;

    return {
      totalReports: total,
      activeReports: active,
      deprecatedReports: deprecated,
      branches,
      oldestReport: dates?.oldest,
      newestReport: dates?.newest,
      cacheSize,
    };
  }

  /**
   * Parse database row to ReportRecord
   */
  private parseReportRow(row: any): ReportRecord {
    return {
      id: row.id,
      projectPath: row.project_path,
      title: row.title || "Untitled Report",
      summary: row.summary || "",
      branch: row.branch,
      commitHash: row.commit_hash,
      timestamp: row.timestamp,
      overview: JSON.parse(row.overview),
      aiAnalysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      deprecated: row.deprecated === 1,
      deprecatedAt: row.deprecated_at || undefined,
      deprecatedReason: row.deprecated_reason || undefined,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
