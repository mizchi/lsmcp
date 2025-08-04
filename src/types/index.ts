/**
 * Central type definitions
 * Re-exports all types from subdirectories
 */

// LSP types
export type {
  ServerCharacteristics,
  ServerCapabilities,
  LspAdapter,
  LanguageConfig,
  LanguageConfigJson,
} from "./lsp.ts";

// MCP types
export type { ToolDef } from "./mcp.ts";

// Config types
export type { ServerCapabilitiesConfig, LspAdapterConfig } from "./config.ts";
export { serverCapabilitiesSchema, lspAdapterConfigSchema } from "./config.ts";
