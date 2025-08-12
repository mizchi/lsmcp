/**
 * LSP Client state management
 */

import { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import type {
  ServerCapabilities,
  Diagnostic,
  DocumentUri,
} from "../protocol/types/index.ts";
import type { IFileSystem } from "../interfaces.ts";

export interface LSPClientState {
  process: ChildProcess | null;
  messageId: number;
  responseHandlers: Map<
    number | string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timer?: NodeJS.Timeout;
    }
  >;
  buffer: string;
  contentLength: number;
  diagnostics: Map<DocumentUri, Diagnostic[]>;
  eventEmitter: EventEmitter;
  rootPath: string;
  languageId: string;
  serverCharacteristics?: Record<string, any>;
  fileSystemApi: IFileSystem;
  serverCapabilities?: ServerCapabilities;
}

export interface LSPClientConfig {
  process: ChildProcess;
  rootPath: string;
  languageId?: string;
  serverCharacteristics?: Record<string, any>;
  fileSystemApi?: IFileSystem;
  clientName?: string;
  clientVersion?: string;
  initializationOptions?: Record<string, unknown>;
}

export function createInitialState(config: LSPClientConfig): LSPClientState {
  return {
    process: config.process,
    messageId: 0,
    responseHandlers: new Map(),
    buffer: "",
    contentLength: -1,
    diagnostics: new Map(),
    eventEmitter: new EventEmitter(),
    rootPath: config.rootPath,
    languageId: config.languageId || "plaintext",
    serverCharacteristics: config.serverCharacteristics,
    fileSystemApi: config.fileSystemApi || createDefaultFileSystemApi(),
  };
}

function createDefaultFileSystemApi(): IFileSystem {
  // Import dynamically to avoid circular dependencies
  const { nodeFileSystemApi } = require("../utils/filesystem.ts");
  return nodeFileSystemApi;
}
