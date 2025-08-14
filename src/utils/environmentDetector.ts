import { existsSync } from "fs";
import { join } from "path";
import { debugLog } from "./debugLog.ts";

export interface DetectedEnvironment {
  preset: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  suggestedFiles?: string[];
}

export function detectEnvironment(root: string): DetectedEnvironment | null {
  debugLog("environment", `Detecting environment in ${root}`);

  if (
    existsSync(join(root, "deno.json")) ||
    existsSync(join(root, "deno.jsonc"))
  ) {
    return {
      preset: "deno",
      confidence: "high",
      reason: "Found deno.json/deno.jsonc configuration file",
      suggestedFiles: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    };
  }

  if (existsSync(join(root, "tsconfig.json"))) {
    const packageJsonPath = join(root, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          require("fs").readFileSync(packageJsonPath, "utf-8"),
        );

        if (
          packageJson.devDependencies?.["tsgo"] ||
          packageJson.dependencies?.["tsgo"]
        ) {
          return {
            preset: "tsgo",
            confidence: "high",
            reason: "Found tsconfig.json with tsgo in dependencies",
            suggestedFiles: ["**/*.ts", "**/*.tsx"],
          };
        }

        if (
          packageJson.devDependencies?.["typescript"] ||
          packageJson.dependencies?.["typescript"]
        ) {
          return {
            preset: "typescript",
            confidence: "high",
            reason: "Found tsconfig.json with TypeScript in dependencies",
            suggestedFiles: ["**/*.ts", "**/*.tsx", "**/*.d.ts"],
          };
        }
      } catch (e) {
        debugLog("environment", `Failed to parse package.json: ${e}`);
      }
    }

    return {
      preset: "typescript",
      confidence: "medium",
      reason: "Found tsconfig.json",
      suggestedFiles: ["**/*.ts", "**/*.tsx", "**/*.d.ts"],
    };
  }

  if (existsSync(join(root, "Cargo.toml"))) {
    return {
      preset: "rust-analyzer",
      confidence: "high",
      reason: "Found Cargo.toml",
      suggestedFiles: ["**/*.rs"],
    };
  }

  if (existsSync(join(root, "go.mod"))) {
    return {
      preset: "gopls",
      confidence: "high",
      reason: "Found go.mod",
      suggestedFiles: ["**/*.go"],
    };
  }

  if (
    existsSync(join(root, "pyproject.toml")) ||
    existsSync(join(root, "setup.py")) ||
    existsSync(join(root, "requirements.txt"))
  ) {
    return {
      preset: "pyright",
      confidence: "high",
      reason:
        "Found Python project files (pyproject.toml/setup.py/requirements.txt)",
      suggestedFiles: ["**/*.py", "**/*.pyi"],
    };
  }

  if (existsSync(join(root, "*.fsproj")) || existsSync(join(root, "*.sln"))) {
    return {
      preset: "fsautocomplete",
      confidence: "high",
      reason: "Found F# project files",
      suggestedFiles: ["**/*.fs", "**/*.fsi", "**/*.fsx"],
    };
  }

  if (existsSync(join(root, "moon.mod.json"))) {
    return {
      preset: "moonbit",
      confidence: "high",
      reason: "Found moon.mod.json",
      suggestedFiles: ["**/*.mbt"],
    };
  }

  if (existsSync(join(root, "gleam.toml"))) {
    return {
      preset: "gleam",
      confidence: "high",
      reason: "Found gleam.toml",
      suggestedFiles: ["**/*.gleam"],
    };
  }

  if (existsSync(join(root, "package.json"))) {
    return {
      preset: "typescript",
      confidence: "low",
      reason: "Found package.json (assuming Node.js/TypeScript project)",
      suggestedFiles: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    };
  }

  debugLog("environment", "Could not detect environment");
  return null;
}

export function formatEnvironmentGuide(detected: DetectedEnvironment): string {
  const lines = [
    `🔍 Environment Detection`,
    ``,
    `Detected: ${detected.preset} (${detected.confidence} confidence)`,
    `Reason: ${detected.reason}`,
  ];

  if (detected.suggestedFiles && detected.suggestedFiles.length > 0) {
    lines.push(``, `Suggested file patterns:`);
    detected.suggestedFiles.forEach((pattern) => {
      lines.push(`  - ${pattern}`);
    });
  }

  lines.push(
    ``,
    `To use this preset, create .lsmcp/config.json with:`,
    ``,
    `{`,
    `  "preset": "${detected.preset}"`,
  );

  if (detected.suggestedFiles && detected.suggestedFiles.length > 0) {
    lines.push(
      `  "files": ${JSON.stringify(detected.suggestedFiles, null, 2).split("\n").join("\n  ")}`,
    );
  }

  lines.push(`}`);

  return lines.join("\n");
}
