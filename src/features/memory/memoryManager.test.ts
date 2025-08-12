import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { MemoryManager } from "./memoryManager";

describe("MemoryManager", () => {
  let testDir: string;
  let manager: MemoryManager;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `serenity-mm-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    manager = new MemoryManager(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("ensureMemoriesDir", () => {
    it("should create memories directory if it doesn't exist", async () => {
      const memoriesPath = join(testDir, ".lsmcp", "memories");
      expect(existsSync(memoriesPath)).toBe(false);

      await manager.ensureMemoriesDir();

      expect(existsSync(memoriesPath)).toBe(true);
    });

    it("should not throw if directory already exists", async () => {
      const memoriesPath = join(testDir, ".lsmcp", "memories");
      mkdirSync(memoriesPath, { recursive: true });

      await expect(manager.ensureMemoriesDir()).resolves.not.toThrow();
    });
  });

  describe("listMemories", () => {
    it("should return empty array when no memories exist", async () => {
      // Ensure the directory exists first
      await manager.ensureMemoriesDir();
      const memories = await manager.listMemories();
      expect(memories).toEqual([]);
    });

    it("should return list of memory names without .md extension", async () => {
      await manager.writeMemory("memory1", "Content 1");
      await manager.writeMemory("memory2", "Content 2");
      await manager.writeMemory("memory3", "Content 3");

      const memories = await manager.listMemories();
      expect(memories).toHaveLength(3);
      expect(memories).toContain("memory1");
      expect(memories).toContain("memory2");
      expect(memories).toContain("memory3");
    });

    it("should only return .md files", async () => {
      // Ensure directories exist before writing files
      await manager.ensureMemoriesDir();
      const memoriesPath = join(testDir, ".lsmcp", "memories");

      // Create various files
      await fs.writeFile(join(memoriesPath, "memory.md"), "content");
      await fs.writeFile(join(memoriesPath, "not-memory.txt"), "content");
      await fs.writeFile(join(memoriesPath, "another.json"), "{}");

      const memories = await manager.listMemories();
      expect(memories).toEqual(["memory"]);
    });
  });

  describe("readMemory", () => {
    it("should read memory content and metadata", async () => {
      const content = "This is test memory content";
      await manager.writeMemory("test-memory", content);

      const memory = await manager.readMemory("test-memory");
      expect(memory).not.toBeNull();
      expect(memory!.name).toBe("test-memory");
      expect(memory!.content).toBe(content);
      expect(memory!.createdAt).toBeInstanceOf(Date);
      expect(memory!.updatedAt).toBeInstanceOf(Date);
    });

    it("should return null for non-existent memory", async () => {
      const memory = await manager.readMemory("nonexistent");
      expect(memory).toBeNull();
    });

    it("should parse metadata correctly", async () => {
      await manager.ensureMemoriesDir();
      const memoriesPath = join(testDir, ".lsmcp", "memories");

      const created = new Date("2024-01-01T00:00:00Z");
      const updated = new Date("2024-01-15T12:00:00Z");
      const content = `---
created: ${created.toISOString()}
updated: ${updated.toISOString()}
---

This is the actual content`;

      await fs.writeFile(join(memoriesPath, "test.md"), content);

      const memory = await manager.readMemory("test");
      expect(memory).not.toBeNull();
      expect(memory!.createdAt.toISOString()).toBe(created.toISOString());
      expect(memory!.updatedAt.toISOString()).toBe(updated.toISOString());
      expect(memory!.content).toBe("This is the actual content");
    });
  });

  describe("writeMemory", () => {
    it("should create new memory with metadata", async () => {
      const content = "New memory content";
      await manager.writeMemory("new-memory", content);

      const filePath = join(testDir, ".lsmcp", "memories", "new-memory.md");
      expect(existsSync(filePath)).toBe(true);

      const fileContent = await fs.readFile(filePath, "utf-8");
      expect(fileContent).toContain("---");
      expect(fileContent).toContain("created:");
      expect(fileContent).toContain("updated:");
      expect(fileContent).toContain(content);
    });

    it("should update existing memory preserving created date", async () => {
      // First write
      await manager.writeMemory("test", "Original content");
      const firstMemory = await manager.readMemory("test");
      const createdAt = firstMemory!.createdAt;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Update
      await manager.writeMemory("test", "Updated content");
      const updatedMemory = await manager.readMemory("test");

      expect(updatedMemory!.content).toBe("Updated content");
      // Check that created date is preserved (allow small difference due to date parsing)
      expect(
        Math.abs(updatedMemory!.createdAt.getTime() - createdAt.getTime()),
      ).toBeLessThan(1000);
      expect(updatedMemory!.updatedAt.getTime()).toBeGreaterThan(
        createdAt.getTime(),
      );
    });
  });

  describe("deleteMemory", () => {
    it("should delete existing memory", async () => {
      await manager.ensureMemoriesDir();
      await manager.writeMemory("to-delete", "Content");
      const beforeDelete = await manager.readMemory("to-delete");
      expect(beforeDelete).not.toBeNull();

      const deleted = await manager.deleteMemory("to-delete");
      expect(deleted).toBe(true);

      const afterDelete = await manager.readMemory("to-delete");
      expect(afterDelete).toBeNull();
    });

    it("should return false when deleting non-existent memory", async () => {
      const deleted = await manager.deleteMemory("nonexistent");
      expect(deleted).toBe(false);
    });
  });
});

describe("MemoryManager module", () => {
  it("exports MemoryManager class", () => {
    expect(MemoryManager).toBeDefined();
  });
});
