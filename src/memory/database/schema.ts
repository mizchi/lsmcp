/**
 * Database schema for advanced memory storage
 */

export interface ReportRecord {
  id: string;
  projectPath: string;
  title: string;
  summary: string;
  branch: string;
  commitHash: string;
  timestamp: string;
  overview: ProjectOverview;
  aiAnalysis?: AIAnalysis;
  metadata?: Record<string, any>;
  deprecated?: boolean;
  deprecatedAt?: string;
  deprecatedReason?: string;
}

export interface ProjectOverview {
  // Mechanical overview
  totalFiles: number;
  totalSymbols: number;
  languages: LanguageStats[];
  structure: DirectoryStructure;
  dependencies?: DependencyInfo[];
  symbolBreakdown: SymbolBreakdown;
}

export interface LanguageStats {
  language: string;
  files: number;
  lines: number;
  percentage: number;
}

export interface DirectoryStructure {
  name: string;
  type: "directory" | "file";
  children?: DirectoryStructure[];
  symbolCount?: number;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: "runtime" | "dev" | "peer";
}

export interface SymbolBreakdown {
  classes: number;
  interfaces: number;
  functions: number;
  variables: number;
  types: number;
  enums: number;
  modules: number;
}

export interface AIAnalysis {
  // AI-generated deep analysis
  summary: string;
  architecture: string;
  keyComponents: ComponentAnalysis[];
  codeQuality: CodeQualityMetrics;
  suggestions: string[];
  technicalDebt?: string[];
  securityConsiderations?: string[];
  performanceNotes?: string[];
  timestamp: string;
  model?: string;
}

export interface ComponentAnalysis {
  name: string;
  purpose: string;
  dependencies: string[];
  complexity: "low" | "medium" | "high";
  notes?: string;
}

export interface CodeQualityMetrics {
  maintainability: number; // 0-100
  testCoverage?: number; // 0-100
  documentationLevel: "poor" | "basic" | "good" | "excellent";
  codeConsistency: "low" | "medium" | "high";
  architectureAdherence: "weak" | "moderate" | "strong";
}

// Database queries
export const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    branch TEXT NOT NULL,
    commit_hash TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    overview TEXT NOT NULL,
    ai_analysis TEXT,
    metadata TEXT,
    deprecated INTEGER DEFAULT 0,
    deprecated_at TEXT,
    deprecated_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_path, commit_hash)
  );

  CREATE INDEX IF NOT EXISTS idx_reports_project_branch 
    ON reports(project_path, branch);
  
  CREATE INDEX IF NOT EXISTS idx_reports_commit 
    ON reports(commit_hash);
  
  CREATE INDEX IF NOT EXISTS idx_reports_timestamp 
    ON reports(timestamp);
  
  CREATE INDEX IF NOT EXISTS idx_reports_title
    ON reports(title);
  
  CREATE INDEX IF NOT EXISTS idx_reports_deprecated
    ON reports(deprecated);

  CREATE TABLE IF NOT EXISTS analysis_cache (
    id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    analysis TEXT NOT NULL,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_analysis_cache_project 
    ON analysis_cache(project_path);
  
  CREATE INDEX IF NOT EXISTS idx_analysis_cache_hash 
    ON analysis_cache(content_hash);
`;
