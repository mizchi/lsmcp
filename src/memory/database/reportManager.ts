/**
 * Manager for generating and storing project reports with AI analysis
 */

import { createHash } from "crypto";
import type { SymbolIndexState } from "../../indexer/symbolIndex.ts";
import { getSymbolIndex } from "../../indexer/symbolIndex.ts";
import { MemoryDatabase } from "./memoryDatabase.ts";
import type {
  ProjectOverview,
  AIAnalysis,
  SymbolBreakdown,
  LanguageStats,
  DirectoryStructure,
  DependencyInfo,
} from "./schema.ts";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { globSync } from "glob";
import { SymbolKind } from "vscode-languageserver-protocol";

const execAsync = promisify(exec);

export class ReportManager {
  private db: MemoryDatabase;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.db = new MemoryDatabase(projectPath);
  }

  /**
   * Generate a comprehensive project report
   */
  async generateReport(
    includeAIAnalysis: boolean = false,
    aiPrompt?: string,
  ): Promise<string> {
    // Get current git information
    const gitInfo = await this.getGitInfo();

    // Generate mechanical overview
    const overview = await this.generateProjectOverview();

    // Generate AI analysis if requested
    let aiAnalysis: AIAnalysis | undefined;
    if (includeAIAnalysis) {
      const contentHash = this.generateContentHash(overview);

      // Check cache first
      aiAnalysis = (await this.db.getCachedAnalysis(contentHash)) || undefined;

      if (!aiAnalysis && aiPrompt) {
        // AI analysis would be generated here
        // For now, we'll create a placeholder
        aiAnalysis = await this.generateAIAnalysis(overview, aiPrompt);

        // Cache the analysis
        if (aiAnalysis) {
          await this.db.cacheAnalysis(contentHash, aiAnalysis);
        }
      }
    }

    // Save report to database
    const reportId = await this.db.saveReport(
      gitInfo.branch,
      gitInfo.commitHash,
      overview,
      aiAnalysis,
      { generatedBy: "ReportManager", version: "1.0" },
    );

    return reportId;
  }

  /**
   * Generate mechanical project overview
   */
  private async generateProjectOverview(): Promise<ProjectOverview> {
    const state = getSymbolIndex(this.projectPath);

    // Get file statistics
    const files = this.getAllProjectFiles();
    const languages = this.analyzeLanguages(files);

    // Get symbol statistics
    const symbolBreakdown = await this.getSymbolBreakdown(state);

    // Get directory structure
    const structure = this.buildDirectoryStructure();

    // Get dependencies
    const dependencies = this.getDependencies();

    return {
      totalFiles: files.length,
      totalSymbols: Object.values(symbolBreakdown).reduce((a, b) => a + b, 0),
      languages,
      structure,
      dependencies,
      symbolBreakdown,
    };
  }

  /**
   * Get all project files (excluding ignored)
   */
  private getAllProjectFiles(): string[] {
    const ignorePatterns = [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.lsmcp/cache/**",
    ];

    const files = globSync("**/*", {
      cwd: this.projectPath,
      nodir: true,
      ignore: ignorePatterns,
    });

    return files;
  }

  /**
   * Analyze language distribution
   */
  private analyzeLanguages(files: string[]): LanguageStats[] {
    const stats = new Map<string, { files: number; lines: number }>();

    const extensionMap: Record<string, string> = {
      ".ts": "TypeScript",
      ".tsx": "TypeScript",
      ".js": "JavaScript",
      ".jsx": "JavaScript",
      ".py": "Python",
      ".rs": "Rust",
      ".go": "Go",
      ".java": "Java",
      ".cpp": "C++",
      ".c": "C",
      ".cs": "C#",
      ".rb": "Ruby",
      ".php": "PHP",
      ".swift": "Swift",
      ".kt": "Kotlin",
      ".scala": "Scala",
      ".vue": "Vue",
      ".svelte": "Svelte",
    };

    let totalLines = 0;

    for (const file of files) {
      const ext = file.substring(file.lastIndexOf("."));
      const lang = extensionMap[ext];

      if (lang) {
        const filePath = join(this.projectPath, file);
        if (existsSync(filePath)) {
          try {
            const content = readFileSync(filePath, "utf-8");
            const lines = content.split("\n").length;

            const current = stats.get(lang) || { files: 0, lines: 0 };
            current.files++;
            current.lines += lines;
            stats.set(lang, current);
            totalLines += lines;
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }

    const result: LanguageStats[] = [];
    for (const [language, stat] of stats) {
      result.push({
        language,
        files: stat.files,
        lines: stat.lines,
        percentage: totalLines > 0 ? (stat.lines / totalLines) * 100 : 0,
      });
    }

    return result.sort((a, b) => b.lines - a.lines);
  }

  /**
   * Get symbol breakdown by type
   */
  private async getSymbolBreakdown(
    state: SymbolIndexState,
  ): Promise<SymbolBreakdown> {
    const breakdown: SymbolBreakdown = {
      classes: 0,
      interfaces: 0,
      functions: 0,
      variables: 0,
      types: 0,
      enums: 0,
      modules: 0,
    };

    // Check if state has symbolIndex
    if (!state.symbolIndex) {
      return breakdown;
    }

    // Iterate through all symbols in the index
    for (const symbols of state.symbolIndex.values()) {
      for (const symbol of symbols) {
        switch (symbol.kind) {
          case SymbolKind.Class:
            breakdown.classes++;
            break;
          case SymbolKind.Interface:
            breakdown.interfaces++;
            break;
          case SymbolKind.Function:
          case SymbolKind.Method:
            breakdown.functions++;
            break;
          case SymbolKind.Variable:
          case SymbolKind.Constant:
            breakdown.variables++;
            break;
          case SymbolKind.TypeParameter:
            breakdown.types++;
            break;
          case SymbolKind.Enum:
            breakdown.enums++;
            break;
          case SymbolKind.Module:
          case SymbolKind.Namespace:
            breakdown.modules++;
            break;
        }
      }
    }

    return breakdown;
  }

  /**
   * Build directory structure
   */
  private buildDirectoryStructure(): DirectoryStructure {
    // Simplified directory structure
    // In a real implementation, this would build a full tree
    return {
      name: this.projectPath.split("/").pop() || "project",
      type: "directory",
      children: [
        { name: "src", type: "directory", symbolCount: 0 },
        { name: "tests", type: "directory", symbolCount: 0 },
        { name: "docs", type: "directory", symbolCount: 0 },
      ],
    };
  }

  /**
   * Get project dependencies
   */
  private getDependencies(): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];

    // Check for package.json (Node.js)
    const packageJsonPath = join(this.projectPath, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

        if (packageJson.dependencies) {
          for (const [name, version] of Object.entries(
            packageJson.dependencies,
          )) {
            dependencies.push({
              name,
              version: version as string,
              type: "runtime",
            });
          }
        }

        if (packageJson.devDependencies) {
          for (const [name, version] of Object.entries(
            packageJson.devDependencies,
          )) {
            dependencies.push({
              name,
              version: version as string,
              type: "dev",
            });
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check for Cargo.toml (Rust)
    const cargoTomlPath = join(this.projectPath, "Cargo.toml");
    if (existsSync(cargoTomlPath)) {
      try {
        const cargoToml = readFileSync(cargoTomlPath, "utf-8");
        const depRegex = /^\[dependencies\]([\s\S]*?)(?=^\[|$)/gm;
        const match = depRegex.exec(cargoToml);
        if (match) {
          const depLines = match[1].split("\n");
          for (const line of depLines) {
            const depMatch = /^(\w+)\s*=\s*"([^"]+)"/.exec(line.trim());
            if (depMatch) {
              dependencies.push({
                name: depMatch[1],
                version: depMatch[2],
                type: "runtime",
              });
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return dependencies;
  }

  /**
   * Generate AI analysis placeholder
   */
  private async generateAIAnalysis(
    overview: ProjectOverview,
    _prompt: string,
  ): Promise<AIAnalysis> {
    // This is a placeholder for AI analysis
    // In a real implementation, this would call an AI service

    const timestamp = new Date().toISOString();

    return {
      summary: `Project with ${overview.totalFiles} files and ${overview.totalSymbols} symbols`,
      architecture: "Modular architecture with clear separation of concerns",
      keyComponents: [
        {
          name: "Core",
          purpose: "Main application logic",
          dependencies: [],
          complexity: "medium",
        },
      ],
      codeQuality: {
        maintainability: 75,
        documentationLevel: "good",
        codeConsistency: "high",
        architectureAdherence: "strong",
      },
      suggestions: [
        "Consider adding more unit tests",
        "Update documentation for recent changes",
      ],
      timestamp,
      model: "placeholder",
    };
  }

  /**
   * Get current git information
   */
  private async getGitInfo(): Promise<{
    branch: string;
    commitHash: string;
  }> {
    try {
      const { stdout: branch } = await execAsync(
        "git rev-parse --abbrev-ref HEAD",
        { cwd: this.projectPath },
      );

      const { stdout: commitHash } = await execAsync("git rev-parse HEAD", {
        cwd: this.projectPath,
      });

      return {
        branch: branch.trim(),
        commitHash: commitHash.trim(),
      };
    } catch {
      // Fallback if not a git repository
      return {
        branch: "main",
        commitHash: "unknown",
      };
    }
  }

  /**
   * Generate content hash for caching
   */
  private generateContentHash(overview: ProjectOverview): string {
    const content = JSON.stringify(overview);
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Get latest report for current branch
   */
  async getLatestReport() {
    const gitInfo = await this.getGitInfo();
    return this.db.getLatestReport(gitInfo.branch);
  }

  /**
   * Get report history
   */
  async getHistory(limit: number = 10) {
    const gitInfo = await this.getGitInfo();
    return this.db.getReportHistory(gitInfo.branch, limit);
  }

  /**
   * Get database statistics
   */
  async getStatistics() {
    return this.db.getStatistics();
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}
