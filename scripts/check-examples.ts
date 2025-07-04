#!/usr/bin/env npx tsx
/**
 * Test diagnostics for all example projects
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestResult {
  language: string;
  project: string;
  success: boolean;
  errors: number;
  warnings: number;
  message?: string;
}

interface LanguageConfig {
  language: string;
  testFiles: string[];
  lspCommand?: string;
  checkCommand?: string; // Command to check if dependency is installed
  installHint?: string; // How to install the dependency
}

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  typescript: {
    language: "typescript",
    testFiles: ["test-diagnostics.ts"],
    // TypeScript LSP is bundled with the project, no external dependency
  },
  "rust-project": {
    language: "rust",
    testFiles: ["src/test_diagnostics.rs"],
    lspCommand: "rust-analyzer",
    checkCommand: "rust-analyzer --version",
    installHint: "Install with: rustup component add rust-analyzer",
  },
  "moonbit-project": {
    language: "moonbit",
    testFiles: ["src/test/test_diagnostics.mbt"],
    lspCommand: "npx moonbit-lsp",
    // No checkCommand needed - npx will handle installation automatically
  },
  "fsharp-project": {
    language: "fsharp",
    testFiles: ["TestDiagnostics.fs"],
    lspCommand: "fsautocomplete",
    checkCommand: "fsautocomplete --version",
    installHint: "Install with: dotnet tool install -g fsautocomplete",
  },
};

/**
 * Check if a command is available in the system
 */
function isCommandAvailable(command: string): boolean {
  try {
    execSync(command, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function testProjectDiagnostics(
  projectPath: string,
  config: LanguageConfig,
): Promise<TestResult> {
  const projectName = dirname(projectPath);
  console.log(`\n📁 Testing ${config.language} in ${projectName}...`);

  const transport = new StdioClientTransport({
    command: "node",
    args: [join(__dirname, "../dist/lsmcp.js"), "--language", config.language],
    cwd: projectPath,
    env: {
      ...process.env,
      ...(config.lspCommand && { LSP_COMMAND: config.lspCommand }),
    },
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);

    let totalErrors = 0;
    let totalWarnings = 0;

    // Test each configured test file
    for (const testFile of config.testFiles) {
      const filePath = join(projectPath, testFile);

      // Skip if test file doesn't exist yet
      if (!existsSync(filePath)) {
        console.log(`  ⚠️  Test file ${testFile} not found, skipping...`);
        continue;
      }

      try {
        const result = (await client.callTool({
          name: "get_diagnostics",
          arguments: {
            root: projectPath,
            filePath: testFile,
          },
        })) as { content: Array<{ type: string; text: string }> };

        const text = result.content[0].text;
        console.log(`  📄 ${testFile}:`);

        // Parse errors and warnings from result
        const errorMatch = text.match(/(\d+) errors?/);
        const warningMatch = text.match(/(\d+) warnings?/);

        const errors = errorMatch ? parseInt(errorMatch[1]) : 0;
        const warnings = warningMatch ? parseInt(warningMatch[1]) : 0;

        totalErrors += errors;
        totalWarnings += warnings;

        console.log(`     ✓ Found ${errors} errors, ${warnings} warnings`);

        // Show first few diagnostics
        const lines = text.split("\n");
        const diagnosticLines = lines
          .filter(
            (line: string) =>
              line.startsWith("ERROR:") || line.startsWith("WARNING:"),
          )
          .slice(0, 3);

        diagnosticLines.forEach((line: string) => {
          console.log(`     ${line}`);
        });

        if (
          diagnosticLines.length <
          lines.filter(
            (line: string) =>
              line.startsWith("ERROR:") || line.startsWith("WARNING:"),
          ).length
        ) {
          console.log(`     ... and more`);
        }
      } catch (error) {
        console.error(`  ❌ Error testing ${testFile}: ${error.message}`);
        throw error;
      }
    }

    await client.close();

    return {
      language: config.language,
      project: projectName,
      success: true,
      errors: totalErrors,
      warnings: totalWarnings,
    };
  } catch (error) {
    return {
      language: config.language,
      project: projectName,
      success: false,
      errors: 0,
      warnings: 0,
      message: error.message,
    };
  }
}

async function main() {
  console.log("🧪 Testing diagnostics for all example projects\n");

  const results: TestResult[] = [];
  const skipped: Array<{ project: string; reason: string }> = [];

  // Test each project
  for (const [projectDir, config] of Object.entries(LANGUAGE_CONFIGS)) {
    const projectPath = resolve(__dirname, "../examples", projectDir);

    if (!existsSync(projectPath)) {
      console.log(`⚠️  Project ${projectDir} not found, skipping...`);
      continue;
    }

    // Check if dependencies are available
    if (config.checkCommand && !isCommandAvailable(config.checkCommand)) {
      console.log(`\n📁 Testing ${config.language} in ${projectDir}...`);
      console.log(
        `  ⚠️  Dependency not found: ${
          config.lspCommand || config.language
        } LSP server`,
      );
      console.log(`  ℹ️  ${config.installHint}`);
      console.log(`  ⏭️  Skipping ${config.language} tests\n`);

      skipped.push({
        project: projectDir,
        reason: `${config.lspCommand || config.language} not installed`,
      });
      continue;
    }

    const result = await testProjectDiagnostics(projectPath, config);
    results.push(result);
  }

  // Summary
  console.log("\n📊 Summary:");
  console.log("═".repeat(60));

  const successCount = results.filter((r) => r.success).length;
  console.log(`Total projects: ${results.length + skipped.length}`);
  console.log(`Tested: ${results.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${results.length - successCount}`);
  console.log(`Skipped: ${skipped.length}`);

  if (results.length > 0) {
    console.log("\nTest results:");
    for (const result of results) {
      const status = result.success ? "✅" : "❌";
      const details = result.success
        ? `${result.errors} errors, ${result.warnings} warnings`
        : `Failed: ${result.message}`;
      console.log(`${status} ${result.language.padEnd(15)} - ${details}`);
    }
  }

  if (skipped.length > 0) {
    console.log("\nSkipped projects:");
    for (const skip of skipped) {
      console.log(`⏭️  ${skip.project.padEnd(15)} - ${skip.reason}`);
    }
  }

  // Exit with error code if any tests failed (but not if only skipped)
  if (results.length > 0 && successCount < results.length) {
    process.exit(1);
  }
}

main().catch(console.error);
