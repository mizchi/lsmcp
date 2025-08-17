import { getContentHash } from "./contentHash.ts";
import type { FileSymbols } from "./types.ts";

export interface FileDiffCheckResult {
  hasChanged: boolean;
  contentHash: string;
  reason: "new" | "content-changed" | "unchanged";
}

export interface FileDiffChecker {
  checkFile(
    content: string,
    existingFile?: FileSymbols,
  ): FileDiffCheckResult;
}

/**
 * Optimized content-based diff checker with early exit strategies
 */
export class ContentHashDiffChecker implements FileDiffChecker {
  // Cache for recently computed hashes (LRU-like)
  private recentHashes = new Map<string, { hash: string; timestamp: number }>();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_TTL = 5000; // 5 seconds
  
  checkFile(
    content: string,
    existingFile?: FileSymbols,
  ): FileDiffCheckResult {
    // Fast path: new file
    if (!existingFile) {
      const contentHash = this.computeHashWithCache(content);
      return {
        hasChanged: true,
        contentHash,
        reason: "new",
      };
    }

    // Fast path: quick length check for obvious changes
    // If we stored content length, we could do a quick check here
    // But we need to compute hash anyway for the result
    
    const contentHash = this.computeHashWithCache(content);
    
    // Fast string comparison
    if (existingFile.contentHash === contentHash) {
      return {
        hasChanged: false,
        contentHash,
        reason: "unchanged",
      };
    }

    return {
      hasChanged: true,
      contentHash,
      reason: "content-changed",
    };
  }
  
  private computeHashWithCache(content: string): string {
    // For very small content, caching might be slower than hashing
    if (content.length < 100) {
      return getContentHash(content);
    }
    
    // Create a simple content key (first 50 + last 50 chars + length)
    // This is much faster than hashing for cache lookup
    const cacheKey = this.createCacheKey(content);
    
    // Check cache
    const cached = this.recentHashes.get(cacheKey);
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < this.CACHE_TTL) {
        // Cache hit
        return cached.hash;
      }
      // Expired, remove it
      this.recentHashes.delete(cacheKey);
    }
    
    // Compute hash
    const hash = getContentHash(content);
    
    // Update cache
    this.addToCache(cacheKey, hash);
    
    return hash;
  }
  
  private createCacheKey(content: string): string {
    const len = content.length;
    if (len < 100) {
      // For small content, use the content itself as key
      return content;
    }
    // For larger content, use a fingerprint
    // This is much faster than full hashing for cache lookup
    return `${content.slice(0, 50)}...${content.slice(-50)}:${len}`;
  }
  
  private addToCache(key: string, hash: string): void {
    // Simple LRU: if cache is full, remove oldest
    if (this.recentHashes.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry (first in map)
      const firstKey = this.recentHashes.keys().next().value;
      if (firstKey) {
        this.recentHashes.delete(firstKey);
      }
    }
    
    this.recentHashes.set(key, {
      hash,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Clear the cache (useful for tests or memory management)
   */
  clearCache(): void {
    this.recentHashes.clear();
  }
}

/**
 * Factory function to create the default diff checker
 */
export function createDiffChecker(): FileDiffChecker {
  return new ContentHashDiffChecker();
}

// Export for backwards compatibility
export const OptimizedDiffChecker = ContentHashDiffChecker;