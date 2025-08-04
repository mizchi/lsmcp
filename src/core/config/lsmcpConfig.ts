/**
 * Configuration for lsmcp project
 * Re-export from configSchema.ts for backward compatibility
 */

export {
  type LSMCPConfig,
  type LspAdapter,
  type ServerCharacteristics,
  DEFAULT_CONFIG,
  validateConfig,
  createConfigFromAdapter,
} from "./configSchema.ts";

// Re-export AdapterConfig as alias for LspAdapter for backward compatibility
export type { LspAdapter as AdapterConfig } from "./configSchema.ts";
