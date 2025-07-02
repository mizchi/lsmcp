import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";

/**
 * Pyright adapter - Microsoft's Python language server
 */
export const pyrightAdapter: LspAdapter = {
  id: "pyright",
  name: "Pyright",
  baseLanguage: "python",
  description: "Microsoft's Pyright Python language server",
  extensions: [".py", ".pyw", ".pyi", ".ipynb"],
  lspCommand: "uv",
  lspArgs: ["run", "pyright", "--stdio"],
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
    // First check if pyright is directly available
    try {
      execSync("which pyright", { stdio: "ignore" });
      // If pyright is directly available, update the adapter to use it directly
      pyrightAdapter.lspCommand = "pyright";
      pyrightAdapter.lspArgs = ["--stdio"];
      return { ok: true };
    } catch {
      // If not, check for uv
      try {
        execSync("which uv", { stdio: "ignore" });
        return { ok: true };
      } catch {
        return {
          ok: false,
          message:
            "Neither pyright nor uv found in PATH. Install pyright with: npm install -g pyright, or install uv with: curl -LsSf https://astral.sh/uv/install.sh | sh",
        };
      }
    }
  },
};
