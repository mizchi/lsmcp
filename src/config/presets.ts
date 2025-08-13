/**
 * Default presets for language servers
 */

import type { PresetRegistry } from "./loader.ts";
import { tsgoAdapter } from "../presets/tsgo.ts";
import { typescriptAdapter } from "../presets/typescript-language-server.ts";
import { rustAnalyzerAdapter } from "../presets/rust-analyzer.ts";
import { pyrightAdapter } from "../presets/pyright.ts";
import { goplsAdapter } from "../presets/gopls.ts";
import { fsharpAdapter } from "../presets/fsharp.ts";
import { denoAdapter } from "../presets/deno.ts";
import { moonbitAdapter } from "../presets/moonbit.ts";

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
