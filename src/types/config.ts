/**
 * Configuration-related type definitions
 */

import { z } from "zod";

// Server capabilities schema for config files
export const serverCapabilitiesSchema = z
  .object({
    supportsRename: z.boolean().optional(),
    supportsReferences: z.boolean().optional(),
    supportsDefinition: z.boolean().optional(),
    supportsHover: z.boolean().optional(),
    supportsDocumentSymbol: z.boolean().optional(),
    supportsWorkspaceSymbol: z.boolean().optional(),
    supportsCompletion: z.boolean().optional(),
    supportsSignatureHelp: z.boolean().optional(),
    supportsDocumentFormatting: z.boolean().optional(),
    supportsRangeFormatting: z.boolean().optional(),
    supportsCodeAction: z.boolean().optional(),
    supportsDiagnostics: z.boolean().optional(),
    supportsInlayHint: z.boolean().optional(),
    supportsSemanticTokens: z.boolean().optional(),
  })
  .optional();

// LSP adapter configuration schema for config files
export const lspAdapterConfigSchema = z.object({
  /** Unique identifier for the adapter */
  id: z.string().describe("Unique identifier for the adapter"),

  /** Display name */
  name: z.string().describe("Display name for the adapter"),

  /** LSP server binary/command */
  bin: z.string().describe("LSP server binary path or command"),

  /** Arguments to pass to the LSP server */
  args: z
    .array(z.string())
    .default([])
    .describe("Arguments for the LSP server")
    .optional(),

  /** Base language ID */
  baseLanguage: z
    .string()
    .optional()
    .describe("Base language ID (e.g., 'typescript')"),

  /** Description */
  description: z.string().optional().describe("Description of the adapter"),

  /** Unsupported features */
  unsupported: z
    .array(z.string())
    .optional()
    .describe("List of unsupported MCP tools"),

  /** Language-specific initialization options */
  initializationOptions: z
    .any()
    .optional()
    .describe("LSP initialization options"),

  /** Server capabilities */
  serverCapabilities: serverCapabilitiesSchema,
});

// Type exports
export type ServerCapabilitiesConfig = z.infer<typeof serverCapabilitiesSchema>;
export type LspAdapterConfig = z.infer<typeof lspAdapterConfigSchema>;
