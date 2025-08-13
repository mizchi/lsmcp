import type { LSPClient } from "../protocol/types/index.ts";
import type { ChildProcess } from "child_process";
import { createLSPClient } from "../core/client.ts";
import { createAndInitializeLSPClient } from "../core/client-legacy.ts";
import type { IServerCharacteristics } from "../interfaces.ts";

export interface ManagedClient {
  id: string;
  client: LSPClient;
  process: ChildProcess;
  projectRoot: string;
  createdAt: Date;
}

export class ClientManager {
  private clients: Map<string, ManagedClient> = new Map();
  private defaultClientId: string | null = null;

  /**
   * Create a new LSP client and register it with the manager
   */
  async createClient(
    id: string,
    options: {
      rootPath: string;
      process: ChildProcess;
      languageId?: string;
      initializationOptions?: Record<string, unknown>;
      serverCharacteristics?: IServerCharacteristics;
    }
  ): Promise<LSPClient> {
    if (this.clients.has(id)) {
      throw new Error(`Client with id '${id}' already exists`);
    }

    const client = createLSPClient(options);
    
    this.clients.set(id, {
      id,
      client,
      process: options.process,
      projectRoot: options.rootPath,
      createdAt: new Date(),
    });

    // Set as default if it's the first client
    if (this.clients.size === 1) {
      this.defaultClientId = id;
    }

    return client;
  }

  /**
   * Create and initialize a new LSP client
   */
  async createAndInitializeClient(
    id: string,
    projectRoot: string,
    process: ChildProcess,
    languageId?: string,
    initializationOptions?: Record<string, unknown>,
    serverCharacteristics?: IServerCharacteristics
  ): Promise<LSPClient> {
    if (this.clients.has(id)) {
      throw new Error(`Client with id '${id}' already exists`);
    }

    const client = await createAndInitializeLSPClient(
      projectRoot,
      process,
      languageId,
      initializationOptions,
      serverCharacteristics
    );

    this.clients.set(id, {
      id,
      client,
      process,
      projectRoot,
      createdAt: new Date(),
    });

    // Set as default if it's the first client
    if (this.clients.size === 1) {
      this.defaultClientId = id;
    }

    return client;
  }

  /**
   * Get a client by ID
   */
  getClient(id: string): LSPClient | undefined {
    return this.clients.get(id)?.client;
  }

  /**
   * Get the default client
   */
  getDefaultClient(): LSPClient | undefined {
    if (!this.defaultClientId) {
      return undefined;
    }
    return this.clients.get(this.defaultClientId)?.client;
  }

  /**
   * Set the default client
   */
  setDefaultClient(id: string): void {
    if (!this.clients.has(id)) {
      throw new Error(`Client with id '${id}' does not exist`);
    }
    this.defaultClientId = id;
  }

  /**
   * List all client IDs
   */
  listClients(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get detailed information about all clients
   */
  getClientsInfo(): ManagedClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Stop and remove a client
   */
  async removeClient(id: string): Promise<void> {
    const managed = this.clients.get(id);
    if (!managed) {
      return;
    }

    // Stop the client
    await managed.client.stop().catch(() => {});
    
    // Remove from map
    this.clients.delete(id);

    // Update default if needed
    if (this.defaultClientId === id) {
      const remaining = Array.from(this.clients.keys());
      this.defaultClientId = remaining[0] || null;
    }
  }

  /**
   * Stop and remove all clients
   */
  async removeAllClients(): Promise<void> {
    const promises = Array.from(this.clients.values()).map((managed) =>
      managed.client.stop().catch(() => {})
    );
    
    await Promise.all(promises);
    this.clients.clear();
    this.defaultClientId = null;
  }

  /**
   * Get the number of active clients
   */
  get size(): number {
    return this.clients.size;
  }
}

// No singleton - create your own ClientManager instance