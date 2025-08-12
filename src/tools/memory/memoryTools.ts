import { z } from "zod";
import type { ToolDef } from "@lsmcp/lsp-client";
import { MemoryManager } from "../../features/memory/memoryManager.ts";

const listMemoriesSchema = z.object({
  root: z.string().describe("Root directory of the project"),
});

export const listMemoriesTool: ToolDef<typeof listMemoriesSchema> = {
  name: "list_memories",
  description: "List available memories for the current project",
  schema: listMemoriesSchema,
  execute: async ({ root }) => {
    const manager = new MemoryManager(root);
    const memories = await manager.listMemories();
    return JSON.stringify(memories);
  },
};

const readMemorySchema = z.object({
  root: z.string().describe("Root directory of the project"),
  memoryName: z.string().describe("Name of the memory to read"),
});

export const readMemoryTool: ToolDef<typeof readMemorySchema> = {
  name: "read_memory",
  description: "Read a specific memory from the project",
  schema: readMemorySchema,
  execute: async ({ root, memoryName }) => {
    const manager = new MemoryManager(root);
    const memory = await manager.readMemory(memoryName);

    if (!memory) {
      throw new Error(`Memory '${memoryName}' not found`);
    }

    return memory.content;
  },
};

const writeMemorySchema = z.object({
  root: z.string().describe("Root directory of the project"),
  memoryName: z.string().describe("Name of the memory to write"),
  content: z.string().describe("Content to save in the memory"),
});

export const writeMemoryTool: ToolDef<typeof writeMemorySchema> = {
  name: "write_memory",
  description: "Write or update a memory for the project",
  schema: writeMemorySchema,
  execute: async ({ root, memoryName, content }) => {
    const manager = new MemoryManager(root);
    await manager.writeMemory(memoryName, content);
    return `Memory '${memoryName}' saved successfully`;
  },
};

const deleteMemorySchema = z.object({
  root: z.string().describe("Root directory of the project"),
  memoryName: z.string().describe("Name of the memory to delete"),
});

export const deleteMemoryTool: ToolDef<typeof deleteMemorySchema> = {
  name: "delete_memory",
  description: "Delete a memory from the project",
  schema: deleteMemorySchema,
  execute: async ({ root, memoryName }) => {
    const manager = new MemoryManager(root);
    const deleted = await manager.deleteMemory(memoryName);

    if (!deleted) {
      throw new Error(`Memory '${memoryName}' not found`);
    }

    return `Memory '${memoryName}' deleted successfully`;
  },
};
