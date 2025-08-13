/**
 * Adapter registration setup
 */

import { PresetRegistry } from "../config/loader.ts";

// Import all adapters
import { typescriptAdapter } from "../presets/typescript-language-server.ts";
import { tsgoAdapter } from "../presets/tsgo.ts";
import { denoAdapter } from "../presets/deno.ts";
import { pyrightAdapter } from "../presets/pyright.ts";
import { rustAnalyzerAdapter } from "../presets/rust-analyzer.ts";
import { fsharpAdapter } from "../presets/fsharp.ts";
import { moonbitAdapter } from "../presets/moonbit.ts";
import { goplsAdapter } from "../presets/gopls.ts";

/**
 * Register all built-in adapters
 */
export function registerBuiltinAdapters(registry: PresetRegistry): void {
  registry.register(typescriptAdapter);
  registry.register(tsgoAdapter);
  registry.register(denoAdapter);
  registry.register(pyrightAdapter);
  registry.register(rustAnalyzerAdapter);
  registry.register(fsharpAdapter);
  registry.register(moonbitAdapter);
  registry.register(goplsAdapter);
}
