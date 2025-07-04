/**
 * Adapter registration setup
 */

import { AdapterRegistry } from "../../core/config/configLoader.ts";

// Import all adapters
import { typescriptAdapter } from "../../adapters/typescript-language-server.ts";
import { tsgoAdapter } from "../../adapters/tsgo.ts";
import { denoAdapter } from "../../adapters/deno.ts";
import { pyrightAdapter } from "../../adapters/pyright.ts";
import { ruffAdapter } from "../../adapters/ruff.ts";
import { rustAnalyzerAdapter } from "../../adapters/rust-analyzer.ts";
import { fsharpAdapter } from "../../adapters/fsharp.ts";
import { moonbitAdapter } from "../../adapters/moonbit.ts";
import { goplsAdapter } from "../../adapters/gopls.ts";

/**
 * Register all built-in adapters
 */
export function registerBuiltinAdapters(registry: AdapterRegistry): void {
  registry.register(typescriptAdapter);
  registry.register(tsgoAdapter);
  registry.register(denoAdapter);
  registry.register(pyrightAdapter);
  registry.register(ruffAdapter);
  registry.register(rustAnalyzerAdapter);
  registry.register(fsharpAdapter);
  registry.register(moonbitAdapter);
  registry.register(goplsAdapter);
}
