/**
 * LSP-related type definitions
 */

// Re-export types from schema
export type {
  ServerCharacteristics,
  ServerCapabilities,
  LspAdapter,
  Preset,
} from "./schema.ts";

// Configuration file format (same as LspAdapter now)
import type { LspAdapter } from "./schema.ts";
export type LanguageConfigJson = LspAdapter;
