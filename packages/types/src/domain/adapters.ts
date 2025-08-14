/**
 * Configuration for LSP client
 * Simplified configuration without unnecessary abstractions
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
