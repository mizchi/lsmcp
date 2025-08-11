/**
 * Indexer-related validation schemas using Zod
 */

import { z } from "zod";

// Symbol kind enum for indexing
export const SymbolKindSchema = z.enum([
  "File",
  "Module",
  "Namespace",
  "Package",
  "Class",
  "Method",
  "Property",
  "Field",
  "Constructor",
  "Enum",
  "Interface",
  "Function",
  "Variable",
  "Constant",
  "String",
  "Number",
  "Boolean",
  "Array",
  "Object",
  "Key",
  "Null",
  "EnumMember",
  "Struct",
  "Event",
  "Operator",
  "TypeParameter",
]);

// Note: SymbolKind type is exported from lsp/index.ts to avoid conflicts
// This is just the validation schema
export type SymbolKindValue = z.infer<typeof SymbolKindSchema>;

// Index operation schemas
export const indexFilesSchema = z.object({
  root: z.string().optional().describe("Root directory for the project"),
  pattern: z.string().optional().describe("Glob pattern for files to index"),
  noCache: z
    .boolean()
    .default(false)
    .describe("Force full re-index, ignoring cache"),
  forceReset: z
    .boolean()
    .default(false)
    .describe("Completely reset the index before starting"),
  concurrency: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .describe("Number of files to index in parallel"),
});

export const searchSymbolSchema = z.object({
  root: z.string().optional().describe("Root directory for the project"),
  name: z.string().optional().describe("Symbol name to search for"),
  kind: z
    .union([SymbolKindSchema, z.array(SymbolKindSchema)])
    .optional()
    .describe("Symbol kind(s) to filter by"),
  file: z.string().optional().describe("File path to search within"),
  containerName: z.string().optional().describe("Container name"),
  includeChildren: z.boolean().default(true).describe("Include child symbols"),
  includeExternal: z
    .boolean()
    .default(false)
    .describe("Include external library symbols"),
  onlyExternal: z
    .boolean()
    .default(false)
    .describe("Only return external library symbols"),
  sourceLibrary: z
    .string()
    .optional()
    .describe("Filter by specific library name"),
});

export const clearIndexSchema = z.object({
  root: z.string().optional().describe("Root directory for the project"),
  force: z
    .boolean()
    .default(false)
    .describe("Force clear all caches including SQLite cache"),
});
