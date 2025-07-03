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
  bin: "uv",
  args: ["run", "pyright-langserver", "--stdio"],
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
      execSync("uv run pyright-langserver --version", {
        stdio: "ignore",
        timeout: 5000,
      });
      return { ok: true, message: "pyright-langserver available via uv" };
    } catch {
      return {
        ok: false,
        message:
          "pyright-langserver not available via uv. Install with: uv add pyright",
      };
    }
  },
};
