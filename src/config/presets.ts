/**
 * Default presets for language servers
 */

import type { PresetRegistry } from "./loader.ts";
import { tsgoAdapter } from "../adapters/tsgo.ts";
import { typescriptAdapter } from "../adapters/typescriptLanguageServer.ts";
import { rustAnalyzerAdapter } from "../adapters/rustAnalyzer.ts";
import { pyrightAdapter } from "../adapters/pyright.ts";
import { goplsAdapter } from "../adapters/gopls.ts";
import { fsharpAdapter } from "../adapters/fsharp.ts";
import { denoAdapter } from "../adapters/deno.ts";
import { moonbitAdapter } from "../adapters/moonbit.ts";

/**
 * Register all default presets
 */
export function registerDefaultPresets(registry: PresetRegistry): void {
  // TypeScript-based presets
  registry.register(tsgoAdapter);
  registry.register(typescriptAdapter);
  registry.register(denoAdapter);

  // Other language presets
  registry.register(rustAnalyzerAdapter);
  registry.register(pyrightAdapter);
  registry.register(goplsAdapter);
  registry.register(fsharpAdapter);
  registry.register(moonbitAdapter);
}
