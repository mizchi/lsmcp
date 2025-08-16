/**
 * Common LSP-related validation schemas using Zod
 */

import { z } from "zod";

// Base schemas for common LSP parameters
export const lspSchemas = {
  root: z.string().describe("Root directory for resolving relative paths"),

  relativePath: z.string().describe("File path (relative to root)"),

  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),

  symbolName: z.string().describe("Name of the symbol"),

  character: z.number().describe("Character position in the line (0-based)"),

  symbolIndex: z
    .number()
    .default(0)
    .describe(
      "Index of the symbol occurrence if it appears multiple times on the line (0-based)",
    ),

  before: z
    .number()
    .default(0)
    .describe("Number of lines to show before the definition"),

  after: z
    .number()
    .default(0)
    .describe("Number of lines to show after the definition"),

  textTarget: z.string().optional().describe("Text to find in the file"),

  column: z
    .number()
    .optional()
    .describe("Column position in the line (0-based)"),

  includeBody: z
    .boolean()
    .optional()
    .describe("Include the full body of the symbol"),

  forceRefresh: z
    .boolean()
    .optional()
    .describe("Force refresh of the document"),

  timeout: z.number().optional().describe("Timeout in milliseconds"),
} as const;

// Common schema combinations
export const fileLocationSchema = z.object({
  root: lspSchemas.root,
  relativePath: lspSchemas.relativePath,
});

export const symbolLocationSchema = z.object({
  root: lspSchemas.root,
  relativePath: lspSchemas.relativePath,
  line: lspSchemas.line,
  symbolName: lspSchemas.symbolName,
});

export const definitionSchema = symbolLocationSchema.extend({
  before: lspSchemas.before.optional(),
  after: lspSchemas.after.optional(),
  includeBody: lspSchemas.includeBody.optional(),
});

export const hoverSchema = z.object({
  root: lspSchemas.root,
  relativePath: lspSchemas.relativePath,
  line: lspSchemas.line.optional(),
  character: lspSchemas.character.optional(),
  column: lspSchemas.column.optional(),
  textTarget: lspSchemas.textTarget.optional(),
});

export const diagnosticsSchema = z.object({
  root: lspSchemas.root,
  relativePath: lspSchemas.relativePath,
  forceRefresh: lspSchemas.forceRefresh.optional(),
  timeout: lspSchemas.timeout.optional(),
});

// Formatting options schema
export const formattingOptionsSchema = z.object({
  tabSize: z.number().default(2).describe("Number of spaces for indentation"),
  insertSpaces: z
    .boolean()
    .default(true)
    .describe("Use spaces instead of tabs"),
  trimTrailingWhitespace: z
    .boolean()
    .default(true)
    .describe("Trim trailing whitespace"),
  insertFinalNewline: z
    .boolean()
    .default(true)
    .describe("Insert final newline"),
  trimFinalNewlines: z.boolean().default(true).describe("Trim final newlines"),
});

// Re-export commonSchemas for backward compatibility
export const commonSchemas = lspSchemas;
