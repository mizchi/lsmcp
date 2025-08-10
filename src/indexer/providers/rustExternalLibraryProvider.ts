/**
 * Rust external library provider for indexing Cargo dependencies
 */

import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import type { LSPClient } from "../../lsp/lspTypes.ts";
import type { SymbolEntry } from "../symbolIndex.ts";

interface CargoDependency {
  name: string;
  version: string;
  registry?: string;
  path?: string;
  git?: string;
}

// CargoToml interface for future use with proper TOML parser
// interface CargoToml {
//   dependencies?: Record<string, string | CargoDependency>;
//   "dev-dependencies"?: Record<string, string | CargoDependency>;
//   "build-dependencies"?: Record<string, string | CargoDependency>;
// }

/**
 * Parse Cargo.toml to extract dependencies
 */
export async function parseCargoToml(
  rootPath: string,
): Promise<CargoDependency[]> {
  const cargoTomlPath = join(rootPath, "Cargo.toml");

  if (!existsSync(cargoTomlPath)) {
    return [];
  }

  try {
    // Note: In production, use a proper TOML parser like @iarna/toml
    const content = await readFile(cargoTomlPath, "utf-8");
    const dependencies: CargoDependency[] = [];

    // Simple regex-based parsing (replace with proper TOML parser)
    const depSections = [
      "dependencies",
      "dev-dependencies",
      "build-dependencies",
    ];

    for (const section of depSections) {
      const sectionRegex = new RegExp(
        `\\[${section}\\]([\\s\\S]*?)(?:\\n\\[|$)`,
      );
      const match = content.match(sectionRegex);

      if (match) {
        const sectionContent = match[1];
        // Parse simple dependencies: name = "version"
        const simpleDepRegex = /^(\w[\w-]*)\s*=\s*"([^"]+)"/gm;
        let depMatch;

        while ((depMatch = simpleDepRegex.exec(sectionContent)) !== null) {
          dependencies.push({
            name: depMatch[1],
            version: depMatch[2],
          });
        }

        // Parse complex dependencies: name = { version = "...", ... }
        const complexDepRegex = /^(\w[\w-]*)\s*=\s*\{([^}]+)\}/gms;

        while ((depMatch = complexDepRegex.exec(sectionContent)) !== null) {
          const name = depMatch[1];
          const attrs = depMatch[2];

          const versionMatch = attrs.match(/version\s*=\s*"([^"]+)"/);
          const pathMatch = attrs.match(/path\s*=\s*"([^"]+)"/);
          const gitMatch = attrs.match(/git\s*=\s*"([^"]+)"/);

          dependencies.push({
            name,
            version: versionMatch ? versionMatch[1] : "unknown",
            path: pathMatch ? pathMatch[1] : undefined,
            git: gitMatch ? gitMatch[1] : undefined,
          });
        }
      }
    }

    return dependencies;
  } catch (error) {
    console.error("Failed to parse Cargo.toml:", error);
    return [];
  }
}

/**
 * Get Rust crate registry path
 */
function getCrateRegistryPath(): string {
  // Cargo crates are typically stored in ~/.cargo/registry/src/
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    return join(home, ".cargo", "registry", "src");
  }
  return "";
}

/**
 * Find crate source in Cargo registry
 */
export function findCrateSource(
  _crateName: string,
  _version: string,
): string | null {
  const registryPath = getCrateRegistryPath();
  if (!registryPath || !existsSync(registryPath)) {
    return null;
  }

  // Cargo registry structure: ~/.cargo/registry/src/{registry}/{crate-name}-{version}/
  // The registry subdirectory name varies (e.g., github.com-1ecc6299db9ec823)
  // For simplicity, we'd need to scan the directory

  // This is a simplified version - in production, implement proper registry scanning
  return null;
}

/**
 * Get symbols from a Rust crate using rust-analyzer
 *
 * Note: rust-analyzer automatically indexes dependencies when you open a Rust project.
 * The symbols are available through standard LSP requests.
 */
export async function getRustCrateSymbols(
  crateName: string,
  client: LSPClient,
): Promise<SymbolEntry[]> {
  // rust-analyzer provides workspace-wide symbol search
  // Use workspace/symbol to search for symbols from the crate

  try {
    // Search for symbols in the crate namespace
    // For example, searching for "neverthrow::" would find symbols from neverthrow crate
    const symbols = await client.getWorkspaceSymbols(`${crateName}::`);

    // Convert LSP symbols to our SymbolEntry format
    return symbols.map((symbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      location: symbol.location,
      containerName: symbol.containerName,
      isExternal: true,
      sourceLibrary: crateName,
    }));
  } catch (error) {
    console.error(`Failed to get symbols for crate ${crateName}:`, error);
    return [];
  }
}

/**
 * Resolve Rust module imports
 *
 * Rust has several import patterns:
 * - use std::collections::HashMap;
 * - use crate_name::module::Type;
 * - use super::module;
 * - use self::module;
 */
export function parseRustImports(sourceCode: string): RustImport[] {
  const imports: RustImport[] = [];

  // Match use statements including grouped imports like use serde::{Serialize, Deserialize}
  const useRegex =
    /use\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:::(?:[a-zA-Z_][a-zA-Z0-9_]*|(?:\{[^}]+\})))*(?:\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*))?\s*;/g;

  let match;
  while ((match = useRegex.exec(sourceCode)) !== null) {
    const fullMatch = match[0];
    const alias = match[2];

    // Extract crate name (first identifier after "use")
    const crateName = match[1];

    // Skip standard library and relative imports for external library indexing
    if (
      ["std", "core", "alloc", "crate", "super", "self"].includes(crateName)
    ) {
      continue;
    }

    // Extract the full path from the match
    const pathMatch = fullMatch.match(/use\s+([^;]+?)(?:\s+as\s+[^;]+)?\s*;/);
    const fullPath = pathMatch ? pathMatch[1].trim() : crateName;

    imports.push({
      crateName,
      path: fullPath,
      alias: alias || crateName,
      isExternal: true,
    });
  }

  // Also match extern crate statements (older Rust syntax)
  const externCrateRegex =
    /extern\s+crate\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*))?\s*;/g;

  while ((match = externCrateRegex.exec(sourceCode)) !== null) {
    imports.push({
      crateName: match[1],
      path: match[1],
      alias: match[2] || match[1],
      isExternal: true,
    });
  }

  return imports;
}

interface RustImport {
  crateName: string;
  path: string;
  alias: string;
  isExternal: boolean;
}

/**
 * Check if rust-analyzer can handle external library indexing
 *
 * rust-analyzer has excellent built-in support for dependency analysis
 */
export function canRustAnalyzerHandleExternals(client: LSPClient): boolean {
  // Check if client is rust-analyzer
  if (client.languageId !== "rust") {
    return false;
  }

  // rust-analyzer supports workspace/symbol which includes dependencies
  // It also supports textDocument/definition to navigate to dependency sources
  return true;
}

/**
 * Example: Get symbols from a specific Rust crate like "serde"
 */
export async function exampleSerdeSymbols(client: LSPClient): Promise<void> {
  // rust-analyzer automatically indexes all dependencies declared in Cargo.toml
  // We can search for serde symbols directly

  const serdeSymbols = await client.getWorkspaceSymbols("serde::");

  console.log(`Found ${serdeSymbols.length} symbols from serde crate`);

  // Common serde symbols we'd expect to find:
  // - serde::Serialize (trait)
  // - serde::Deserialize (trait)
  // - serde::ser::Serializer (trait)
  // - serde::de::Deserializer (trait)

  for (const symbol of serdeSymbols.slice(0, 10)) {
    console.log(`- ${symbol.name} (${symbol.kind})`);
  }
}
