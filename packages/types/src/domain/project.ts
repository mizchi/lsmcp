// Project and memory domain types

export interface ProjectOverview {
  projectName: string;
  projectType?: string;
  description?: string;
  rootPath: string;
  mainLanguages: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  structure: ProjectStructure;
  statistics: ProjectStatistics;
  keyComponents?: KeyComponent[];
}

export interface ProjectStructure {
  directories: DirectoryInfo[];
  configFiles: string[];
  entryPoints?: string[];
}

export interface DirectoryInfo {
  path: string;
  description?: string;
  fileCount: number;
  purpose?: string;
}

export interface ProjectStatistics {
  totalFiles: number;
  totalLines: number;
  filesByExtension: Record<string, number>;
  languageBreakdown: LanguageStats[];
}

export interface LanguageStats {
  language: string;
  files: number;
  lines: number;
  percentage: number;
  extensions: string[];
}

export interface KeyComponent {
  name: string;
  type: "interface" | "class" | "function" | "module" | "component" | "service";
  path: string;
  description?: string;
  exports?: string[];
  dependencies?: string[];
}

// Memory-related types
export interface Memory {
  name: string;
  content: string;
  metadata?: MemoryMetadata;
}

export interface MemoryMetadata {
  createdAt: Date;
  updatedAt: Date;
  version?: number;
  tags?: string[];
  author?: string;
}

export interface MemoryDatabase {
  listMemories(projectRoot: string): Promise<Memory[]>;
  readMemory(projectRoot: string, name: string): Promise<Memory | null>;
  writeMemory(
    projectRoot: string,
    name: string,
    content: string,
  ): Promise<void>;
  deleteMemory(projectRoot: string, name: string): Promise<void>;
  hasMemory(projectRoot: string, name: string): Promise<boolean>;
}
