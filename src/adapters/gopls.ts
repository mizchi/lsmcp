import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";

/**
 * Gopls adapter for Go language support
 * @see https://pkg.go.dev/golang.org/x/tools/gopls
 */
export const goplsAdapter: LspAdapter = {
  id: "gopls",
  name: "gopls",
  baseLanguage: "go",
  description: "Official Go language server",
  bin: "gopls",
  args: ["serve"],
  initializationOptions: {
    // Enable all gopls features
    codelenses: {
      gc_details: true,
      generate: true,
      regenerate_cgo: true,
      run_govulncheck: true,
      test: true,
      tidy: true,
      upgrade_dependency: true,
      vendor: true,
    },
    analyses: {
      unusedparams: true,
      unusedwrite: true,
      useany: true,
    },
    staticcheck: true,
    gofumpt: true,
    semanticTokens: true,
    noSemanticString: false,
    usePlaceholders: true,
    completeUnimported: true,
    completionBudget: "500ms",
  },
  doctor: async () => {
    const messages: string[] = [];
    const errors: string[] = [];

    try {
      // Check if gopls is installed
      const version = execSync("gopls version", {
        encoding: "utf8",
        stdio: "pipe",
      }).trim();

      messages.push(`✓ gopls is installed: ${version}`);

      // Parse version to check if it's recent enough
      const versionMatch = version.match(/gopls\s+v?(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        const [major, minor] = versionMatch[1].split(".").map(Number);
        if (major === 0 && minor < 14) {
          errors.push(
            "⚠️ gopls version is outdated. Please update to v0.14.0 or later for best results.",
          );
        }
      }

      // Check if Go is installed
      try {
        const goVersion = execSync("go version", {
          encoding: "utf8",
          stdio: "pipe",
        }).trim();
        messages.push(`✓ Go is installed: ${goVersion}`);
      } catch {
        errors.push("✗ Go is not installed or not in PATH");
      }

      // Check GOPATH and GOROOT
      try {
        const gopath = execSync("go env GOPATH", {
          encoding: "utf8",
          stdio: "pipe",
        }).trim();
        const goroot = execSync("go env GOROOT", {
          encoding: "utf8",
          stdio: "pipe",
        }).trim();

        if (gopath) {
          messages.push(`✓ GOPATH is set: ${gopath}`);
        }
        if (goroot) {
          messages.push(`✓ GOROOT is set: ${goroot}`);
        }
      } catch {
        errors.push("⚠️ Unable to check Go environment variables");
      }
    } catch {
      errors.push("✗ gopls is not installed or not in PATH");
      errors.push("  Install with: go install golang.org/x/tools/gopls@latest");
    }

    // Format the message according to the expected interface
    const allMessages = [...messages, ...errors];

    return {
      ok: errors.length === 0,
      message: allMessages.join("\n"),
    };
  },
};
