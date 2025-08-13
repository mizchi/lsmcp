/**
 * Adapter interfaces for FileSystem and LSP Client
 * These are the core contracts that all implementations must follow
 */

import type { Stats } from "node:fs";

/**
 * FileSystem Adapter interface
 * All methods return Promises for async operations
 * Simplified to only handle string operations for code manipulation
 */
export interface FileSystemAdapter {
  // File operations - only string-based for code manipulation
  readFile(path: string): Promise<string>;
  
  writeFile(
    path: string,
    data: string,
  ): Promise<void>;
  
  // Directory operations with overloads
  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<unknown[]>;
  
  mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<string | undefined>;
  
  rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  
  // File system stats
  stat(path: string): Promise<Stats>;
  lstat(path: string): Promise<Stats>;
  exists(path: string): Promise<boolean>;
  
  // Path operations
  realpath(path: string): Promise<string>;
  cwd(): Promise<string>;
  resolve(...paths: string[]): Promise<string>;
  
  // Additional utility methods
  isFile?(path: string): Promise<boolean>;
  isDirectory?(path: string): Promise<boolean>;
}

/**
 * FileSystem Provider interface
 * Providers create and configure FileSystemAdapter instances
 */
export interface FileSystemProvider {
  /**
   * Create a FileSystemAdapter instance
   */
  createAdapter(): FileSystemAdapter;
  
  /**
   * Get provider metadata
   */
  getInfo(): {
    name: string;
    type: 'node' | 'memory' | 'virtual' | 'custom';
    description?: string;
  };
}

/**
 * LSP Client Adapter interface
 * Provides a unified interface for LSP operations
 */
export interface LspClientAdapter {
  // Core properties
  readonly languageId: string;
  readonly rootPath: string;
  
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  isInitialized(): boolean;
  
  // Document management
  openDocument(uri: string, text: string, languageId?: string): void;
  closeDocument(uri: string): void;
  updateDocument(uri: string, text: string, version: number): void;
  isDocumentOpen(uri: string): boolean;
  
  // LSP features - using unknown for LSP types to avoid circular dependencies
  findReferences(uri: string, position: unknown): Promise<unknown[]>;
  getDefinition(
    uri: string,
    position: unknown,
  ): Promise<unknown>;
  getHover(uri: string, position: unknown): Promise<unknown>;
  getDiagnostics(uri: string): unknown[];
  pullDiagnostics(uri: string): Promise<unknown[]>;
  getDocumentSymbols(
    uri: string,
  ): Promise<unknown[]>;
  getWorkspaceSymbols(query: string): Promise<unknown[]>;
  getCompletion(uri: string, position: unknown): Promise<unknown[]>;
  resolveCompletionItem(item: unknown): Promise<unknown>;
  getSignatureHelp(
    uri: string,
    position: unknown,
  ): Promise<unknown>;
  getCodeActions(
    uri: string,
    range: unknown,
    context?: { diagnostics?: unknown[] },
  ): Promise<unknown[]>;
  formatDocument(uri: string, options: unknown): Promise<unknown[]>;
  formatRange(
    uri: string,
    range: unknown,
    options: unknown,
  ): Promise<unknown[]>;
  prepareRename(uri: string, position: unknown): Promise<unknown>;
  rename(
    uri: string,
    position: unknown,
    newName: string,
  ): Promise<unknown>;
  
  // Capabilities
  getServerCapabilities(): unknown;
  supportsFeature(feature: string): boolean;
  
  // Advanced
  sendRequest<T = unknown>(method: string, params?: unknown): Promise<T>;
  waitForDiagnostics(fileUri: string, timeout?: number): Promise<unknown[]>;
}

/**
 * LSP Client Provider interface
 * Providers create and configure LspClientAdapter instances
 */
export interface LspClientProvider {
  /**
   * Create an LspClientAdapter instance
   */
  createAdapter(config: LspClientConfig): Promise<LspClientAdapter>;
  
  /**
   * Get provider metadata
   */
  getInfo(): {
    name: string;
    type: 'native' | 'proxy' | 'mock' | 'custom';
    description?: string;
  };
  
  /**
   * Check if the provider is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Configuration for LSP client
 */
export interface LspClientConfig {
  languageId: string;
  rootPath: string;
  command?: string;
  args?: string[];
  initializationOptions?: Record<string, unknown>;
  serverCapabilities?: unknown;
  env?: Record<string, string>;
}