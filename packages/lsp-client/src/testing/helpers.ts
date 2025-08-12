import { lspProcessPool, type PooledLSPClient } from "../process-pool.ts";
import type { LSPClient } from "../protocol/types-legacy.ts";

let currentPooledClient: PooledLSPClient | null = null;
let currentRoot: string | null = null;

export async function setupLSPForTest(root: string): Promise<LSPClient> {
  currentRoot = root;
  currentPooledClient = await lspProcessPool.acquire(root);
  return currentPooledClient.client;
}

export async function teardownLSPForTest(): Promise<void> {
  if (currentRoot && currentPooledClient) {
    await lspProcessPool.release(currentRoot);
    currentPooledClient = null;
    currentRoot = null;
  }
}

export function getCurrentTestClient(): LSPClient | null {
  return currentPooledClient?.client || null;
}
