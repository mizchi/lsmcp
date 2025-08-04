import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import {
  listMemoriesTool,
  readMemoryTool,
  writeMemoryTool,
  deleteMemoryTool,
} from "./memoryTools.ts";
import { MemoryManager } from "../memory/memoryManager.ts";

vi.mock("../memory/memoryManager.ts");

describe("memoryTools", () => {
  let testDir: string;
  let mockManager: any;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `serenity-memory-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Mock MemoryManager
    mockManager = {
      listMemories: vi.fn(),
      readMemory: vi.fn(),
      writeMemory: vi.fn(),
      deleteMemory: vi.fn(),
    };

    vi.mocked(MemoryManager).mockImplementation(() => mockManager);
  });

  afterEach(async () => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe("listMemories", () => {
    it("should list all memories", async () => {
      const mockMemories = [
        "project-overview",
        "coding-conventions",
        "build-commands",
      ];
      mockManager.listMemories.mockResolvedValue(mockMemories);

      const result = await listMemoriesTool.execute({
        root: testDir,
      });

      expect(JSON.parse(result)).toEqual(mockMemories);
      expect(mockManager.listMemories).toHaveBeenCalledOnce();
    });

    it("should return empty array when no memories", async () => {
      mockManager.listMemories.mockResolvedValue([]);

      const result = await listMemoriesTool.execute({
        root: testDir,
      });

      expect(JSON.parse(result)).toEqual([]);
    });
  });

  describe("readMemory", () => {
    it("should read a specific memory", async () => {
      const mockMemory = {
        name: "project-overview",
        content: "This is a test project using TypeScript and Vitest.",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
      };
      mockManager.readMemory.mockResolvedValue(mockMemory);

      const result = await readMemoryTool.execute({
        root: testDir,
        memoryName: "project-overview",
      });

      expect(result).toBe(mockMemory.content);
      expect(mockManager.readMemory).toHaveBeenCalledWith("project-overview");
    });

    it("should throw when memory not found", async () => {
      mockManager.readMemory.mockResolvedValue(null);

      await expect(
        readMemoryTool.execute({
          root: testDir,
          memoryName: "nonexistent",
        }),
      ).rejects.toThrow("Memory 'nonexistent' not found");
    });
  });

  describe("writeMemory", () => {
    it("should write a new memory", async () => {
      mockManager.writeMemory.mockResolvedValue(undefined);

      const result = await writeMemoryTool.execute({
        root: testDir,
        memoryName: "new-memory",
        content: "This is new memory content",
      });

      expect(result).toBe("Memory 'new-memory' saved successfully");
      expect(mockManager.writeMemory).toHaveBeenCalledWith(
        "new-memory",
        "This is new memory content",
      );
    });

    it("should update existing memory", async () => {
      mockManager.writeMemory.mockResolvedValue(undefined);

      const result = await writeMemoryTool.execute({
        root: testDir,
        memoryName: "existing-memory",
        content: "Updated content",
      });

      expect(result).toBe("Memory 'existing-memory' saved successfully");
      expect(mockManager.writeMemory).toHaveBeenCalledWith(
        "existing-memory",
        "Updated content",
      );
    });
  });

  describe("deleteMemory", () => {
    it("should delete an existing memory", async () => {
      mockManager.deleteMemory.mockResolvedValue(true);

      const result = await deleteMemoryTool.execute({
        root: testDir,
        memoryName: "old-memory",
      });

      expect(result).toBe("Memory 'old-memory' deleted successfully");
      expect(mockManager.deleteMemory).toHaveBeenCalledWith("old-memory");
    });

    it("should throw when memory not found", async () => {
      mockManager.deleteMemory.mockResolvedValue(false);

      await expect(
        deleteMemoryTool.execute({
          root: testDir,
          memoryName: "nonexistent",
        }),
      ).rejects.toThrow("Memory 'nonexistent' not found");
    });
  });
});

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("memoryTools module", () => {
    it("exports all memory tools", () => {
      expect(listMemoriesTool).toBeDefined();
      expect(readMemoryTool).toBeDefined();
      expect(writeMemoryTool).toBeDefined();
      expect(deleteMemoryTool).toBeDefined();
    });

    it("tools have correct names", () => {
      expect(listMemoriesTool.name).toBe("list_memories");
      expect(readMemoryTool.name).toBe("read_memory");
      expect(writeMemoryTool.name).toBe("write_memory");
      expect(deleteMemoryTool.name).toBe("delete_memory");
    });
  });
}
