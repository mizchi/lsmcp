/**
 * Generic interface for external library providers across different languages
 */

import type { LSPClient } from "@internal/lsp-client";
import type { SymbolEntry } from "../symbolIndex.ts";

/**
 * Dependency information common to all languages
 */
export interface DependencyInfo {
  /** Package/library name */
  name: string;
  /** Version string */
  version?: string;
  /** File system location */
  location?: string;
  /** Whether this is a direct or transitive dependency */
  isDirect: boolean;
  /** Additional metadata specific to the language */
  metadata?: Record<string, any>;
}

/**
 * Import statement information
 */
export interface ImportInfo {
  /** The import path/module name */
  source: string;
  /** Local alias if renamed */
  alias?: string;
  /** Specific symbols imported (for selective imports) */
  symbols?: string[];
  /** Whether this is a type-only import */
  isTypeOnly?: boolean;
}

/**
 * Result of indexing external libraries
 */
export interface ExternalLibraryIndexResult {
  /** Total number of dependencies indexed */
  dependencyCount: number;
  /** Total number of symbols found */
  symbolCount: number;
  /** Time taken to index in milliseconds */
  indexingTime: number;
  /** Indexed dependencies */
  dependencies: DependencyInfo[];
  /** Any errors encountered */
  errors?: string[];
}

/**
 * Base interface for language-specific external library providers
 */
export interface ExternalLibraryProvider {
  /** Language identifier (e.g., "typescript", "rust", "go", "python") */
  readonly languageId: string;

  /** Human-readable name of the provider */
  readonly name: string;

  /**
   * Check if this provider can handle the given project
   * @param rootPath Project root directory
   * @returns true if the provider can handle this project type
   */
  canHandle(rootPath: string): Promise<boolean>;

  /**
   * Get list of external dependencies for the project
   * @param rootPath Project root directory
   * @returns List of dependencies
   */
  getDependencies(rootPath: string): Promise<DependencyInfo[]>;

  /**
   * Get symbols from a specific dependency
   * @param dependency The dependency to index
   * @param client LSP client for symbol extraction
   * @returns List of symbols from the dependency
   */
  getSymbols(
    dependency: DependencyInfo,
    client: LSPClient,
  ): Promise<SymbolEntry[]>;

  /**
   * Parse import statements from source code
   * @param sourceCode The source code to parse
   * @param filePath Path to the file (for context)
   * @returns List of imports found
   */
  parseImports(sourceCode: string, filePath: string): ImportInfo[];

  /**
   * Resolve an import path to a file system location
   * @param importPath The import path to resolve
   * @param fromFile The file containing the import
   * @param rootPath Project root directory
   * @returns Resolved file path or null if not found
   */
  resolveImport(
    importPath: string,
    fromFile: string,
    rootPath: string,
  ): Promise<string | null>;

  /**
   * Index all external libraries for the project
   * @param rootPath Project root directory
   * @param client LSP client for symbol extraction
   * @param options Optional configuration
   * @returns Indexing results
   */
  indexExternalLibraries(
    rootPath: string,
    client: LSPClient,
    options?: IndexingOptions,
  ): Promise<ExternalLibraryIndexResult>;

  /**
   * Check if the LSP server natively supports external library indexing
   * @param client The LSP client
   * @returns true if native support is available
   */
  hasNativeLSPSupport(client: LSPClient): boolean;
}

/**
 * Options for indexing external libraries
 */
export interface IndexingOptions {
  /** Maximum number of dependencies to index */
  maxDependencies?: number;
  /** Maximum number of files per dependency */
  maxFilesPerDependency?: number;
  /** Include transitive dependencies */
  includeTransitive?: boolean;
  /** Include development dependencies */
  includeDevDependencies?: boolean;
  /** Patterns to exclude */
  excludePatterns?: string[];
  /** Progress callback */
  onProgress?: (message: string, current: number, total: number) => void;
}

/**
 * Factory for creating language-specific providers
 */
export class ExternalLibraryProviderFactory {
  private static providers: Map<string, ExternalLibraryProvider> = new Map();

  /**
   * Register a provider for a language
   */
  static register(provider: ExternalLibraryProvider): void {
    this.providers.set(provider.languageId, provider);
  }

  /**
   * Get provider for a specific language
   */
  static getProvider(languageId: string): ExternalLibraryProvider | undefined {
    return this.providers.get(languageId);
  }

  /**
   * Detect and get appropriate provider for a project
   */
  static async detectProvider(
    rootPath: string,
  ): Promise<ExternalLibraryProvider | null> {
    for (const provider of this.providers.values()) {
      if (await provider.canHandle(rootPath)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Get all registered providers
   */
  static getAllProviders(): ExternalLibraryProvider[] {
    return Array.from(this.providers.values());
  }
}
