/**
 * Project type detector for automatic preset selection
 */

import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";

export interface DetectedProject {
  preset: string;
  reason: string;
}

/**
 * Detect project type based on project files
 */
export async function detectProjectType(
  projectRoot: string,
): Promise<DetectedProject[]> {
  const detected: DetectedProject[] = [];

  // Check for TypeScript/JavaScript projects
  const packageJsonPath = join(projectRoot, "package.json");
  const tsconfigPath = join(projectRoot, "tsconfig.json");

  if (existsSync(packageJsonPath)) {
    try {
      const packageContent = await readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageContent);

      // Check for tsgo
      if (
        packageJson.devDependencies?.["@typescript/native-preview"] ||
        packageJson.dependencies?.["@typescript/native-preview"]
      ) {
        detected.push({
          preset: "tsgo",
          reason: "Found @typescript/native-preview in package.json",
        });
      }
      // Check for regular TypeScript
      else if (existsSync(tsconfigPath)) {
        detected.push({
          preset: "typescript",
          reason: "Found package.json and tsconfig.json",
        });
      }
    } catch (error) {
      // Ignore parse errors
    }
  }

  // Check for Deno
  if (
    existsSync(join(projectRoot, "deno.json")) ||
    existsSync(join(projectRoot, "deno.jsonc"))
  ) {
    detected.push({
      preset: "deno",
      reason: "Found deno.json or deno.jsonc",
    });
  }

  // Check for F#
  const files = ["*.fsproj"];
  for (const pattern of files) {
    const { glob } = await import("gitaware-glob");
    const matchesGen = await glob(pattern, { cwd: projectRoot });
    const matches = [];
    for await (const match of matchesGen) {
      matches.push(match);
    }
    if (matches.length > 0) {
      detected.push({
        preset: "fsharp",
        reason: `Found ${matches[0]}`,
      });
      break;
    }
  }

  // Check for MoonBit
  if (existsSync(join(projectRoot, "moon.mod.json"))) {
    detected.push({
      preset: "moonbit",
      reason: "Found moon.mod.json",
    });
  }

  // Check for Rust
  if (existsSync(join(projectRoot, "Cargo.toml"))) {
    detected.push({
      preset: "rust-analyzer",
      reason: "Found Cargo.toml",
    });
  }

  // Check for Python
  const pythonFiles = [
    "setup.py",
    "pyproject.toml",
    "requirements.txt",
    "Pipfile",
  ];
  for (const file of pythonFiles) {
    if (existsSync(join(projectRoot, file))) {
      detected.push({
        preset: "pyright",
        reason: `Found ${file}`,
      });
      break;
    }
  }

  // Check for Go
  if (existsSync(join(projectRoot, "go.mod"))) {
    detected.push({
      preset: "gopls",
      reason: "Found go.mod",
    });
  }

  return detected;
}

/**
 * Generate boilerplate config for manual setup
 */
export function generateManualConfigBoilerplate(): string {
  return `{
  "version": "1.0",
  "indexFiles": [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx"
  ],
  "settings": {
    "autoIndex": false,
    "indexConcurrency": 5,
    "autoIndexDelay": 500,
    "enableWatchers": true,
    "memoryLimit": 1024
  },
  "symbolFilter": {
    "excludeKinds": [
      "Variable",
      "Constant",
      "String",
      "Number",
      "Boolean",
      "Array",
      "Object",
      "Key",
      "Null"
    ],
    "excludePatterns": [
      "callback",
      "temp",
      "tmp",
      "_",
      "^[a-z]$"
    ],
    "includeOnlyTopLevel": false
  },
  "ignorePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**"
  ],
  "adapter": {
    "id": "custom",
    "name": "Custom Language Server",
    "bin": "your-language-server",
    "args": ["--stdio"],
    "baseLanguage": "unknown",
    "description": "Configure your language server here"
  }
}`;
}
