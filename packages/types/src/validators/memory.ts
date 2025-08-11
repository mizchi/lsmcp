/**
 * Memory tool validation schemas using Zod
 */

import { z } from "zod";

// Memory operations schemas
export const listMemoriesSchema = z.object({
  root: z.string().describe("Root directory of the project"),
});

export const readMemorySchema = z.object({
  root: z.string().describe("Root directory of the project"),
  memoryName: z.string().describe("Name of the memory to read"),
});

export const writeMemorySchema = z.object({
  root: z.string().describe("Root directory of the project"),
  memoryName: z.string().describe("Name of the memory to write"),
  content: z.string().describe("Content to save in the memory"),
});

export const deleteMemorySchema = z.object({
  root: z.string().describe("Root directory of the project"),
  memoryName: z.string().describe("Name of the memory to delete"),
});

// Advanced memory operations
export const searchMemoriesSchema = z.object({
  root: z.string().describe("Root directory of the project"),
  query: z.string().describe("Search query"),
  caseSensitive: z.boolean().optional().describe("Case sensitive search"),
  regex: z.boolean().optional().describe("Use regex for search"),
});

export const mergeMemoriesSchema = z.object({
  root: z.string().describe("Root directory of the project"),
  sourceMemories: z.array(z.string()).describe("List of memory names to merge"),
  targetMemory: z.string().describe("Target memory name for merged content"),
  deleteSources: z
    .boolean()
    .optional()
    .describe("Delete source memories after merge"),
});

export const compressMemorySchema = z.object({
  root: z.string().describe("Root directory of the project"),
  memoryName: z.string().describe("Name of the memory to compress"),
  algorithm: z.enum(["gzip", "brotli", "deflate"]).optional(),
});
