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
   * Save a new report to the database
   */
  async saveReport(
    branch: string,
    commitHash: string,
    overview: ProjectOverview,
    aiAnalysis?: AIAnalysis,
    metadata?: Record<string, any>,
  ): Promise<string> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO reports (
        id, project_path, branch, commit_hash, 
        timestamp, overview, ai_analysis, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      this.projectPath,
      branch,
      commitHash,
      timestamp,
      JSON.stringify(overview),
      aiAnalysis ? JSON.stringify(aiAnalysis) : null,
      metadata ? JSON.stringify(metadata) : null,
    );

    return id;
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
   * Get the latest report for a branch
   */
  async getLatestReport(branch: string): Promise<ReportRecord | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM reports 
      WHERE project_path = ? AND branch = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);

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
  ): Promise<ReportRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM reports 
      WHERE project_path = ? AND branch = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

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
  ): Promise<ReportRecord[]> {
    let query = `
      SELECT * FROM reports 
      WHERE project_path = ? 
        AND timestamp >= ? 
        AND timestamp <= ?
    `;

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
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalReports: number;
    branches: number;
    oldestReport?: string;
    newestReport?: string;
    cacheSize: number;
  }> {
    const totalStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM reports WHERE project_path = ?
    `);
    const total = (totalStmt.get(this.projectPath) as any).count;

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
      branch: row.branch,
      commitHash: row.commit_hash,
      timestamp: row.timestamp,
      overview: JSON.parse(row.overview),
      aiAnalysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
