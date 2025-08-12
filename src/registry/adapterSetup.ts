/**
 * Adapter registration setup
 */

import { PresetRegistry } from "../config/loader.ts";

// Import all adapters
import { typescriptAdapter } from "../adapters/typescriptLanguageServer.ts";
import { tsgoAdapter } from "../adapters/tsgo.ts";
import { denoAdapter } from "../adapters/deno.ts";
import { pyrightAdapter } from "../adapters/pyright.ts";
import { rustAnalyzerAdapter } from "../adapters/rustAnalyzer.ts";
import { fsharpAdapter } from "../adapters/fsharp.ts";
import { moonbitAdapter } from "../adapters/moonbit.ts";
import { goplsAdapter } from "../adapters/gopls.ts";

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
