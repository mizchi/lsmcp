/**
 * Rust external library provider implementation
 */

import { existsSync } from "fs";
import type { LSPClient } from "@internal/lsp-client";
import type { SymbolEntry } from "../symbolIndex.ts";
import type { SymbolInformation } from "vscode-languageserver-types";
import {
  type ExternalLibraryProvider,
  type DependencyInfo,
  type ImportInfo,
  type ExternalLibraryIndexResult,
  type IndexingOptions,
} from "./externalLibraryInterface.ts";
import { errorLog } from "../../../../src/utils/debugLog.ts";
import {
  parseCargoToml,
  parseRustImports,
  canRustAnalyzerHandleExternals,
} from "./rustExternalLibraryProvider.ts";
import { join } from "path";

export class RustExternalLibraryProvider implements ExternalLibraryProvider {
  readonly languageId = "rust";
  readonly name = "Rust External Library Provider";

  async canHandle(rootPath: string): Promise<boolean> {
    // Check for Cargo.toml
    return existsSync(join(rootPath, "Cargo.toml"));
  }

  async getDependencies(rootPath: string): Promise<DependencyInfo[]> {
    const cargoDeps = await parseCargoToml(rootPath);

    return cargoDeps.map((dep) => ({
      name: dep.name,
      version: dep.version,
      location: dep.path,
      isDirect: true,
      metadata: {
        registry: dep.registry,
        git: dep.git,
      },
    }));
  }

  async getSymbols(
    dependency: DependencyInfo,
    client: LSPClient,
  ): Promise<SymbolEntry[]> {
    // rust-analyzer provides symbols through workspace/symbol
    try {
      const symbols = await client.getWorkspaceSymbols(`${dependency.name}::`);

      return symbols.map((symbol: SymbolInformation) => ({
        name: symbol.name,
        kind: symbol.kind,
        location: symbol.location,
        containerName: symbol.containerName,
        isExternal: true,
        sourceLibrary: dependency.name,
      }));
    } catch (error) {
      errorLog(`Failed to get symbols for ${dependency.name}:`, error);
      return [];
    }
  }

  parseImports(sourceCode: string, _filePath: string): ImportInfo[] {
    const rustImports = parseRustImports(sourceCode);

    return rustImports.map((imp) => ({
      source: imp.crateName,
      alias: imp.alias !== imp.crateName ? imp.alias : undefined,
      symbols: this.extractSymbolsFromPath(imp.path),
    }));
  }

  private extractSymbolsFromPath(path: string): string[] {
    // Handle grouped imports like serde::{Serialize, Deserialize}
    const groupMatch = path.match(/\{([^}]+)\}/);
    if (groupMatch) {
      // Extract symbols from the group
      return groupMatch[1].split(",").map((s) => s.trim());
    }

    // For simple imports, extract the last part
    const parts = path.split("::");
    const lastPart = parts[parts.length - 1];

    // If it's just the crate name, return it
    if (parts.length === 1) {
      return [lastPart];
    }

    // Otherwise return the imported item
    return lastPart ? [lastPart] : [];
  }

  async resolveImport(
    importPath: string,
    _fromFile: string,
    rootPath: string,
  ): Promise<string | null> {
    // For Rust, external crates are resolved by rust-analyzer
    // We don't need to manually resolve file paths
    // rust-analyzer handles this through the Cargo registry

    // Check if it's a crate dependency
    const deps = await this.getDependencies(rootPath);
    const dep = deps.find((d) => d.name === importPath.split("::")[0]);

    if (dep && dep.location) {
      return dep.location;
    }

    return null;
  }

  async indexExternalLibraries(
    rootPath: string,
    client: LSPClient,
    options?: IndexingOptions,
  ): Promise<ExternalLibraryIndexResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Get all dependencies
    const dependencies = await this.getDependencies(rootPath);

    // Limit dependencies if specified
    const depsToIndex = options?.maxDependencies
      ? dependencies.slice(0, options.maxDependencies)
      : dependencies;

    let totalSymbols = 0;

    // Progress tracking
    let current = 0;
    const total = depsToIndex.length;

    for (const dep of depsToIndex) {
      current++;

      if (options?.onProgress) {
        options.onProgress(
          `Indexing ${dep.name}@${dep.version}`,
          current,
          total,
        );
      }

      try {
        const symbols = await this.getSymbols(dep, client);
        totalSymbols += symbols.length;
      } catch (error) {
        errors.push(`Failed to index ${dep.name}: ${error}`);
      }
    }

    const indexingTime = Date.now() - startTime;

    return {
      dependencyCount: depsToIndex.length,
      symbolCount: totalSymbols,
      indexingTime,
      dependencies: depsToIndex,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  hasNativeLSPSupport(client: LSPClient): boolean {
    return canRustAnalyzerHandleExternals(client);
  }
}
