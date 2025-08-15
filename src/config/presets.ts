/**
 * Built-in preset adapters registration
 */

import { PresetRegistry } from "./loader.ts";

// Import all adapters
import { typescriptAdapter } from "../presets/typescript-language-server.ts";
import { tsgoAdapter } from "../presets/tsgo.ts";
import { denoAdapter } from "../presets/deno.ts";
import { pyrightAdapter } from "../presets/pyright.ts";
import { ruffAdapter } from "../presets/ruff.ts";
import { rustAnalyzerAdapter } from "../presets/rust-analyzer.ts";
import { fsharpAdapter } from "../presets/fsharp.ts";
import { moonbitAdapter } from "../presets/moonbit.ts";
import { goplsAdapter } from "../presets/gopls.ts";
import { hlsAdapter } from "../presets/hls.ts";
import { ocamlAdapter } from "../presets/ocaml.ts";

/**
 * Register all built-in adapters to the registry
 */
export function registerBuiltinAdapters(registry: PresetRegistry): void {
  registry.register(typescriptAdapter);
  registry.register(tsgoAdapter);
  registry.register(denoAdapter);
  registry.register(pyrightAdapter);
  registry.register(ruffAdapter);
  registry.register(rustAnalyzerAdapter);
  registry.register(fsharpAdapter);
  registry.register(moonbitAdapter);
  registry.register(goplsAdapter);
  registry.register(hlsAdapter);
  registry.register(ocamlAdapter);
}
