import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";

/**
 * F# Autocomplete (fsautocomplete) adapter
 */
export const fsharpAdapter: LspAdapter = {
  id: "fsharp",
  name: "F# Autocomplete",
  baseLanguage: "fsharp",
  description: "F# language server (fsautocomplete)",
  bin: "fsautocomplete",
  args: [],
  initializationOptions: {
    AutomaticWorkspaceInit: true,
  },
  unsupported: ["get_all_diagnostics"],
  doctor: async () => {
    try {
      execSync("which dotnet", { stdio: "ignore" });
      execSync("which fsautocomplete", { stdio: "ignore" });
      return { ok: true };
    } catch {
      const missing = [];
      try {
        execSync("which dotnet", { stdio: "ignore" });
      } catch {
        missing.push("dotnet");
      }
      try {
        execSync("which fsautocomplete", { stdio: "ignore" });
      } catch {
        missing.push("fsautocomplete");
      }
      return { ok: false, message: `Missing: ${missing.join(", ")}` };
    }
  },
};
