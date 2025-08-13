/**
 * Python external library provider for indexing pip/poetry dependencies
 */

import { existsSync } from "fs";
import { readFile, readdir } from "fs/promises";
import { errorLog } from "../../../../src/utils/debugLog.ts";
import { join, resolve } from "path";
import type { LSPClient } from "@lsmcp/lsp-client";
import type { SymbolEntry } from "../symbolIndex.ts";
import { glob } from "glob";

interface PythonDependency {
  name: string;
  version?: string;
  location: string;
  hasTypeStubs: boolean;
}

/**
 * Detect Python virtual environment
 */
export function detectVirtualEnv(rootPath: string): string | null {
  // Common virtual environment locations
  const venvPaths = [".venv", "venv", "env", ".env", "virtualenv"];

  for (const venvName of venvPaths) {
    const venvPath = join(rootPath, venvName);
    if (existsSync(venvPath)) {
      // Check if it's a valid Python virtual environment
      const sitePackages = findSitePackages(venvPath);
      if (sitePackages) {
        return venvPath;
      }
    }
  }

  return null;
}

/**
 * Find site-packages directory in virtual environment
 */
function findSitePackages(venvPath: string): string | null {
  // Try common locations
  const patterns = [
    "lib/python*/site-packages",
    "lib/python*/dist-packages",
    "Lib/site-packages", // Windows
  ];

  for (const pattern of patterns) {
    const matches = glob.sync(join(venvPath, pattern));
    if (matches.length > 0) {
      return matches[0];
    }
  }

  return null;
}

/**
 * Parse requirements.txt
 */
export async function parseRequirementsTxt(
  rootPath: string,
): Promise<string[]> {
  const requirementsPath = join(rootPath, "requirements.txt");

  if (!existsSync(requirementsPath)) {
    return [];
  }

  try {
    const content = await readFile(requirementsPath, "utf-8");
    const lines = content.split("\n");
    const packages: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Extract package name (before version specifier)
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
      if (match) {
        packages.push(match[1]);
      }
    }

    return packages;
  } catch (error) {
    errorLog("Failed to parse requirements.txt:", error);
    return [];
  }
}

/**
 * Parse pyproject.toml for poetry/pip dependencies
 */
export async function parsePyprojectToml(rootPath: string): Promise<string[]> {
  const pyprojectPath = join(rootPath, "pyproject.toml");

  if (!existsSync(pyprojectPath)) {
    return [];
  }

  try {
    // Note: Use a proper TOML parser in production
    const content = await readFile(pyprojectPath, "utf-8");
    const packages: string[] = [];

    // Find [tool.poetry.dependencies] or [project.dependencies]
    const poetryMatch = content.match(/\[tool\.poetry\.dependencies\]([^[]*)/);
    const projectMatch = content.match(
      /\[project\]\s*dependencies\s*=\s*\[([^\]]*)\]/s,
    );

    if (poetryMatch) {
      // Parse poetry format: package = "version"
      const depSection = poetryMatch[1];
      const depRegex = /^([a-zA-Z0-9_-]+)\s*=/gm;
      let match;

      while ((match = depRegex.exec(depSection)) !== null) {
        if (match[1] !== "python") {
          // Skip Python version constraint
          packages.push(match[1]);
        }
      }
    }

    if (projectMatch) {
      // Parse PEP 621 format: array of strings
      const depArray = projectMatch[1];
      const depRegex = /"([a-zA-Z0-9_-]+)(?:[^"]*)?"/g;
      let match;

      while ((match = depRegex.exec(depArray)) !== null) {
        packages.push(match[1]);
      }
    }

    return packages;
  } catch (error) {
    errorLog("Failed to parse pyproject.toml:", error);
    return [];
  }
}

/**
 * Get installed Python packages from site-packages
 */
export async function getInstalledPackages(
  sitePackagesPath: string,
): Promise<PythonDependency[]> {
  if (!existsSync(sitePackagesPath)) {
    return [];
  }

  try {
    const entries = await readdir(sitePackagesPath, { withFileTypes: true });
    const packages: PythonDependency[] = [];
    const processedNames = new Set<string>();

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const name = entry.name;

        // Skip special directories and duplicates
        if (
          name.startsWith("_") ||
          name.endsWith(".dist-info") ||
          name.endsWith(".egg-info")
        ) {
          continue;
        }

        // Skip if already processed
        if (processedNames.has(name)) {
          continue;
        }

        processedNames.add(name);

        const packagePath = join(sitePackagesPath, name);

        // Check for __init__.py (regular package)
        const hasInit = existsSync(join(packagePath, "__init__.py"));

        // Check for .pyi stub files
        const hasTypeStubs =
          existsSync(join(packagePath, "__init__.pyi")) ||
          existsSync(join(packagePath, "py.typed"));

        if (hasInit || hasTypeStubs) {
          packages.push({
            name,
            location: packagePath,
            hasTypeStubs,
          });
        }
      }
    }

    // Also check for single-file modules (.py files)
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".py")) {
        const name = entry.name.slice(0, -3); // Remove .py extension

        if (!processedNames.has(name) && !name.startsWith("_")) {
          packages.push({
            name,
            location: join(sitePackagesPath, entry.name),
            hasTypeStubs: existsSync(join(sitePackagesPath, `${name}.pyi`)),
          });
        }
      }
    }

    return packages;
  } catch (error) {
    errorLog("Failed to scan site-packages:", error);
    return [];
  }
}

/**
 * Parse Python import statements
 */
export function parsePythonImports(sourceCode: string): PythonImport[] {
  const imports: PythonImport[] = [];

  // Match: import module
  const importRegex =
    /^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)(?:\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*))?/gm;

  let match;
  while ((match = importRegex.exec(sourceCode)) !== null) {
    imports.push({
      module: match[1],
      alias: match[2],
      symbols: [],
      isFrom: false,
    });
  }

  // Match: from module import symbol1, symbol2
  const fromImportRegex =
    /^from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import\s+([^#\n]+)/gm;

  while ((match = fromImportRegex.exec(sourceCode)) !== null) {
    const module = match[1];
    const symbolsStr = match[2];

    // Parse imported symbols
    const symbols: Array<{ name: string; alias?: string }> = [];

    if (symbolsStr.trim() === "*") {
      symbols.push({ name: "*" });
    } else {
      // Parse comma-separated symbols with potential aliases
      const symbolRegex =
        /([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*))?/g;
      let symbolMatch;

      while ((symbolMatch = symbolRegex.exec(symbolsStr)) !== null) {
        symbols.push({
          name: symbolMatch[1],
          alias: symbolMatch[2],
        });
      }
    }

    imports.push({
      module,
      symbols,
      isFrom: true,
    });
  }

  return imports;
}

interface PythonImport {
  module: string;
  alias?: string;
  symbols: Array<{ name: string; alias?: string }>;
  isFrom: boolean;
}

/**
 * Get Python package symbols using Pylsp/Pyright
 *
 * Note: Pyright automatically indexes installed packages and provides excellent type information
 */
export async function getPythonPackageSymbols(
  packageName: string,
  packagePath: string,
  client: LSPClient,
): Promise<SymbolEntry[]> {
  const symbols: SymbolEntry[] = [];

  try {
    // Get all Python files in the package
    const pythonFiles = await glob(`${packagePath}/**/*.py`, {
      ignore: ["**/__pycache__/**", "**/test/**", "**/tests/**"],
    });

    // Also get .pyi stub files
    const stubFiles = await glob(`${packagePath}/**/*.pyi`);

    const allFiles = [...pythonFiles, ...stubFiles];

    for (const file of allFiles) {
      const fileUri = `file://${resolve(file)}`;

      // Get symbols from the file
      const fileSymbols = await client.getDocumentSymbols(fileUri);

      // Convert and mark as external
      for (const symbol of fileSymbols) {
        symbols.push({
          name: symbol.name,
          kind: symbol.kind,
          location: (symbol as any).location || {
            uri: fileUri,
            range: (symbol as any).range,
          },
          containerName: (symbol as any).containerName,
          isExternal: true,
          sourceLibrary: packageName,
        });
      }
    }
  } catch (error) {
    errorLog(`Failed to get symbols for package ${packageName}:`, error);
  }

  return symbols;
}

/**
 * Example: Index NumPy package symbols
 */
export async function exampleNumpyIndexing(
  rootPath: string,
  client: LSPClient,
): Promise<void> {
  // Detect virtual environment
  const venv = detectVirtualEnv(rootPath);
  if (!venv) {
    console.log("No virtual environment found");
    return;
  }

  const sitePackages = findSitePackages(venv);
  if (!sitePackages) {
    console.log("No site-packages found");
    return;
  }

  // Check if numpy is installed
  const numpyPath = join(sitePackages, "numpy");
  if (!existsSync(numpyPath)) {
    console.log("NumPy not installed");
    return;
  }

  console.log("Indexing NumPy symbols...");

  // Get numpy symbols
  const symbols = await getPythonPackageSymbols("numpy", numpyPath, client);

  console.log(`Found ${symbols.length} symbols in NumPy`);

  // Common NumPy symbols we'd expect:
  // - numpy.ndarray (class)
  // - numpy.array (function)
  // - numpy.zeros (function)
  // - numpy.ones (function)
  // - numpy.dot (function)
  // - numpy.linalg (module)

  const importantSymbols = symbols.filter((s) =>
    ["ndarray", "array", "zeros", "ones", "dot", "linalg"].includes(s.name),
  );

  for (const symbol of importantSymbols) {
    console.log(`- ${symbol.name} (${symbol.kind})`);
  }
}
