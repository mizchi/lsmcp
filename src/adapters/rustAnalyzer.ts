import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";

/**
 * rust-analyzer adapter
 */
export const rustAnalyzerAdapter: LspAdapter = {
  id: "rust-analyzer",
  name: "rust-analyzer",
  baseLanguage: "rust",
  description: "Official Rust language server",
  bin: "rust-analyzer",
  args: [],
  initializationOptions: {
    cargo: {
      features: "all",
    },
    // procMacro: {
    //   enable: true,
    // },
  },
  doctor: async () => {
    try {
      execSync("which rust-analyzer", { stdio: "ignore" });
      return { ok: true };
    } catch {
      return { ok: false, message: "rust-analyzer not found in PATH" };
    }
  },
};
