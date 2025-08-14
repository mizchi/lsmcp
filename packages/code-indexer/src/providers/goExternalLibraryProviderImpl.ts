/**
 * Go external library provider implementation
 */

import { existsSync } from "fs";
import type { LSPClient } from "@internal/lsp-client";
import type { SymbolEntry } from "../symbolIndex.ts";
import {
  type ExternalLibraryProvider,
  type DependencyInfo,
  type ImportInfo,
  type ExternalLibraryIndexResult,
  type IndexingOptions,
} from "./externalLibraryInterface.ts";
import {
  parseGoMod,
  parseGoImports,
  classifyGoImport,
  getGoModuleSymbols,
  canGoplsHandleExternals,
  getModuleCachePath,
} from "./goExternalLibraryProvider.ts";
import { join } from "path";

export class GoExternalLibraryProvider implements ExternalLibraryProvider {
  readonly languageId = "go";
  readonly name = "Go External Library Provider";

  async canHandle(rootPath: string): Promise<boolean> {
    // Check for go.mod
    return existsSync(join(rootPath, "go.mod"));
  }

  async getDependencies(rootPath: string): Promise<DependencyInfo[]> {
    const goMod = await parseGoMod(rootPath);

    if (!goMod || !goMod.require) {
      return [];
    }

    return goMod.require.map((req) => ({
      name: req.path,
      version: req.version,
      location: getModuleCachePath(req.path, req.version),
      isDirect: !req.indirect,
      metadata: {
        indirect: req.indirect,
      },
    }));
  }

  async getSymbols(
    dependency: DependencyInfo,
    client: LSPClient,
  ): Promise<SymbolEntry[]> {
    return await getGoModuleSymbols(dependency.name, client);
  }

  parseImports(sourceCode: string, _filePath: string): ImportInfo[] {
    const goImports = parseGoImports(sourceCode);

    return goImports.map((imp) => ({
      source: imp.path,
      alias: imp.alias,
      // Go imports the entire package, not specific symbols
      symbols: [],
    }));
  }

  async resolveImport(
    importPath: string,
    _fromFile: string,
    rootPath: string,
  ): Promise<string | null> {
    // Get module info to classify the import
    const goMod = await parseGoMod(rootPath);
    if (!goMod) {
      return null;
    }

    const importType = classifyGoImport(importPath, goMod.module);

    // Only resolve external imports
    if (importType !== "external") {
      return null;
    }

    // Find the dependency
    const dep = goMod.require?.find((req) => importPath.startsWith(req.path));

    if (dep) {
      const cachePath = getModuleCachePath(dep.path, dep.version);
      if (cachePath && existsSync(cachePath)) {
        // Calculate the full path including subpackages
        const subPath = importPath.substring(dep.path.length);
        return join(cachePath, subPath);
      }
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

    // Filter based on options
    let depsToIndex = dependencies;

    if (!options?.includeTransitive) {
      depsToIndex = depsToIndex.filter((d) => d.isDirect);
    }

    if (options?.maxDependencies) {
      depsToIndex = depsToIndex.slice(0, options.maxDependencies);
    }

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
    return canGoplsHandleExternals(client);
  }
}
