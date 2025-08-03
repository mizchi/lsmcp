import { readFile, writeFile, readdir, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { SerenityMemory } from "../types/index.ts";

export class MemoryManager {
  private memoriesPath: string;

  constructor(rootPath: string) {
    this.memoriesPath = join(rootPath, ".serena", "memories");
  }

  async ensureMemoriesDir(): Promise<void> {
    if (!existsSync(this.memoriesPath)) {
      await mkdir(this.memoriesPath, { recursive: true });
    }
  }

  async listMemories(): Promise<string[]> {
    await this.ensureMemoriesDir();
    const files = await readdir(this.memoriesPath);
    return files.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)); // Remove .md extension
  }

  async readMemory(name: string): Promise<SerenityMemory | null> {
    await this.ensureMemoriesDir();
    const filePath = join(this.memoriesPath, `${name}.md`);

    if (!existsSync(filePath)) {
      return null;
    }

    const content = await readFile(filePath, "utf-8");

    // Parse metadata from content if present
    const metadataMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    let createdAt = new Date();
    let updatedAt = new Date();

    if (metadataMatch) {
      const metadata = metadataMatch[1];
      const createdMatch = metadata.match(/created: (.+)/);
      const updatedMatch = metadata.match(/updated: (.+)/);

      if (createdMatch) createdAt = new Date(createdMatch[1]);
      if (updatedMatch) updatedAt = new Date(updatedMatch[1]);
    }

    return {
      name,
      content: content.replace(/^---\n[\s\S]*?\n---\n/, "").trim(),
      createdAt,
      updatedAt,
    };
  }

  async writeMemory(name: string, content: string): Promise<void> {
    await this.ensureMemoriesDir();
    const filePath = join(this.memoriesPath, `${name}.md`);

    const now = new Date().toISOString();
    const existingMemory = await this.readMemory(name);

    const metadata = `---
created: ${existingMemory?.createdAt.toISOString() || now}
updated: ${now}
---

`;

    await writeFile(filePath, metadata + content, "utf-8");
  }

  async deleteMemory(name: string): Promise<boolean> {
    const filePath = join(this.memoriesPath, `${name}.md`);

    if (existsSync(filePath)) {
      await unlink(filePath);
      return true;
    }

    return false;
  }
}
