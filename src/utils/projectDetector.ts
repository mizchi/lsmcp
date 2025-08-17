/**
 * Project type detector for automatic preset selection
 */

import { existsSync, readdirSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { debug } from "./mcpHelpers.ts";
import { LSMCPError, ErrorCode } from "../domain/errors/index.ts";

interface DetectedProject {
  preset: string;
  reason: string;
}

/**
 * Detect project type based on project files
 */
export async function detectProjectType(
  projectRoot: string,
): Promise<DetectedProject[]> {
  if (!existsSync(projectRoot)) {
    throw new LSMCPError(
      ErrorCode.FILE_NOT_FOUND,
      `Project root not found: ${projectRoot}`,
      { filePath: projectRoot },
      [
        "Ensure the project root path is correct",
        "Use an absolute path to the project directory",
      ],
    );
  }

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
      // Log parse errors but don't fail
      debug(`Failed to parse package.json: ${error}`);
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
  try {
    const files = readdirSync(projectRoot);
    const fsprojFile = files.find((file) => file.endsWith(".fsproj"));
    if (fsprojFile) {
      detected.push({
        preset: "fsharp",
        reason: `Found ${fsprojFile}`,
      });
    }
  } catch (error) {
    // Log read errors but don't fail
    debug(`Failed to read directory for F# detection: ${error}`);
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
  "files": [
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
