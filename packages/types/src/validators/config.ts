/**
 * Configuration validation schemas using Zod
 */

import { z } from "zod";

// Server characteristics schema
export const serverCharacteristicsSchema = z.object({
  documentOpenDelay: z.number().optional(),
  requiresInitialDocument: z.boolean().optional(),
  requiresFileScheme: z.boolean().optional(),
  supportsProgressNotifications: z.boolean().optional(),
  supportsWorkDoneProgress: z.boolean().optional(),
  supportsPartialResults: z.boolean().optional(),
});

// Adapter configuration schema
export const adapterConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  rootMarkers: z.array(z.string()).optional(),
  initializationOptions: z.any().optional(),
  serverCharacteristics: serverCharacteristicsSchema.optional(),
  capabilities: z
    .object({
      hover: z.boolean().optional(),
      definition: z.boolean().optional(),
      references: z.boolean().optional(),
      completion: z.boolean().optional(),
      signatureHelp: z.boolean().optional(),
      diagnostics: z.boolean().optional(),
      codeAction: z.boolean().optional(),
      formatting: z.boolean().optional(),
      rename: z.boolean().optional(),
      documentSymbol: z.boolean().optional(),
      workspaceSymbol: z.boolean().optional(),
    })
    .optional(),
  fileExtensions: z.array(z.string()).optional(),
  languageId: z.string().optional(),
});

// Memory configuration schema
export const memoryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoSave: z.boolean().default(true),
  templates: z.record(z.string()).optional(),
  maxMemories: z.number().default(100),
  compressionEnabled: z.boolean().default(false),
});

// Index configuration schema
export const indexConfigSchema = z.object({
  patterns: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  maxFiles: z.number().optional(),
  concurrency: z.number().optional(),
  cacheEnabled: z.boolean().default(true),
  autoUpdate: z.boolean().default(true),
});

// Main configuration schema
export const configSchema = z.object({
  language: z.string().optional(),
  adapter: adapterConfigSchema.optional(),
  memory: memoryConfigSchema.optional(),
  index: indexConfigSchema.optional(),
  debug: z.boolean().optional(),
  verbose: z.boolean().optional(),
  experimental: z.record(z.any()).optional(),
});
