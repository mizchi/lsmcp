import { execSync } from "node:child_process";
import type { LspAdapter } from "../types.ts";

/**
 * Pyright adapter - Microsoft's Python language server
 */
export const pyrightAdapter: LspAdapter = {
  id: "pyright",
  name: "Pyright",
  baseLanguage: "python",
  description: "Microsoft's Pyright Python language server",
  bin: "pyright-langserver",
  args: ["--stdio"],
  initializationOptions: {
    python: {
      analysis: {
        autoSearchPaths: true,
        useLibraryCodeForTypes: true,
        diagnosticMode: "workspace",
      },
    },
  },
  doctor: async () => {
    try {
      // Check if pyright-langserver is available
      execSync("which pyright-langserver", { stdio: "ignore" });
      return { ok: true };
    } catch {
      try {
        // Check if pyright is available via npx
        execSync("npx pyright-langserver --version", { stdio: "ignore" });
        return {
          ok: true,
          bin: "npx",
          args: ["pyright-langserver", "--stdio"],
        };
      } catch {
        try {
          // Check if pyright is available via uv
          execSync("uv run pyright-langserver --version", { stdio: "ignore" });
          return {
            ok: true,
            bin: "uv",
            args: ["run", "pyright-langserver", "--stdio"],
          };
        } catch {
          return {
            ok: false,
            message:
              "pyright-langserver not found. Install with: npm install -g pyright, or pip install pyright, or uv add pyright",
          };
        }
      }
    }
  },
};
