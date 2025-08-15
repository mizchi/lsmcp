import { globalPresetRegistry } from "../../../../src/config/loader.ts";
import { registerBuiltinAdapters } from "../../../../src/config/presets.ts";

/**
 * Default index patterns for different language adapters
 */

export interface AdapterIndexDefaults {
  patterns: string[];
  concurrency?: number;
}

// Ensure built-in adapters are registered
registerBuiltinAdapters(globalPresetRegistry);

/**
 * Get default patterns for an adapter
 */
export function getAdapterDefaultPattern(adapterId: string): string {
  const preset = globalPresetRegistry.get(adapterId);
  
  // Return empty string if adapter not found - caller should handle this
  if (!preset || !preset.files) {
    return "";
  }
  
  return preset.files.join(",");
}

/**
 * Get default concurrency for an adapter
 */
export function getAdapterDefaultConcurrency(_adapterId: string): number {
  // Default concurrency for all adapters
  // Could be extended to read from preset if we add concurrency settings there
  return 5;
}

/**
 * Get adapter defaults dynamically from preset registry
 */
export function getAdapterDefaults(adapterId: string): AdapterIndexDefaults | undefined {
  const preset = globalPresetRegistry.get(adapterId);
  
  if (!preset || !preset.files) {
    return undefined;
  }
  
  return {
    patterns: preset.files,
    concurrency: 5, // Default concurrency
  };
}