// TypeScript utilities for the Moonbit project

export interface MoonbitConfig {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
}

export function loadConfig(_path: string): MoonbitConfig {
  // Mock implementation
  return {
    name: "moonbit-test",
    version: "0.1.0",
  };
}

export class MoonbitProjectManager {
  private config: MoonbitConfig;

  constructor(configPath: string) {
    this.config = loadConfig(configPath);
  }

  getName(): string {
    return this.config.name;
  }

  getVersion(): string {
    return this.config.version;
  }
}

export type BuildTarget = "wasm" | "js" | "native";
