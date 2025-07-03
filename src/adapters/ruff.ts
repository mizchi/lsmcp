import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";

/**
 * Ruff adapter - Fast Python linter and formatter
 */
export const ruffAdapter: LspAdapter = {
  id: "ruff",
  name: "Ruff",
  baseLanguage: "python",
  description: "Python linter",
  bin: "uv",
  args: ["run", "ruff", "server"],
  initializationOptions: {},
  doctor: async () => {
    // First check if ruff is directly available
    try {
      execSync("which ruff", { stdio: "ignore" });
      // If ruff is directly available, update the adapter to use it directly
      ruffAdapter.bin = "ruff";
      ruffAdapter.args = ["server"];
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
            "Neither ruff nor uv found in PATH. Install ruff with: pip install ruff, or install uv with: curl -LsSf https://astral.sh/uv/install.sh | sh",
        };
      }
    }
  },
};
