/**
 * Helper functions that use the dependency container
 */

import { container } from "../container.ts";

// Logger helpers
export function debug(...args: any[]): void {
  container.logger.debug(...args);
}

export function debugLog(...args: any[]): void {
  container.logger.debug(...args);
}

// Error handling helpers
export type ErrorContext = Record<string, any>;

export function formatError(error: any, context?: ErrorContext): string {
  return container.errorHandler.formatError(error, context);
}

// Language detection helper
export function getLanguageIdFromPath(filePath: string): string | null {
  return container.languageDetector.getLanguageId(filePath);
}

// Line resolver helper
export function resolveLineParameter(
  lines: string[],
  line: string | number,
): number {
  return container.lineResolver.resolveLineParameter(lines, line);
}

// Server characteristics helper
export function getServerCharacteristics(
  languageId: string,
  overrides?: any,
): any {
  return container.serverCharacteristicsProvider.getCharacteristics(
    languageId,
    overrides,
  );
}

// FileSystem helpers
export type FileSystemApi = import("../interfaces.ts").IFileSystem;

export const nodeFileSystemApi: FileSystemApi = {
  async readFile(
    path: string,
    encoding: BufferEncoding = "utf-8",
  ): Promise<string> {
    const fs = await import("fs/promises");
    return fs.readFile(path, encoding);
  },
  async writeFile(
    path: string,
    data: string,
    encoding?: BufferEncoding,
  ): Promise<void> {
    const fs = await import("fs/promises");
    await fs.writeFile(path, data, encoding || "utf-8");
  },
  async readdir(path: string): Promise<string[]> {
    const fs = await import("fs/promises");
    return fs.readdir(path);
  },
  async stat(path: string): Promise<any> {
    const fs = await import("fs/promises");
    return fs.stat(path);
  },
  async exists(path: string): Promise<boolean> {
    const fs = await import("fs/promises");
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  },
  async isDirectory(path: string): Promise<boolean> {
    const fs = await import("fs/promises");
    const stats = await fs.stat(path);
    return stats.isDirectory();
  },
  async listDirectory(path: string): Promise<string[]> {
    const fs = await import("fs/promises");
    return fs.readdir(path);
  },
};
