/**
 * General helper utilities
 */

export interface ServerCharacteristics {
  readinessCheckTimeout: number;
  supportsDidSave?: boolean;
  requiresFileWatching?: boolean;
}

export function getServerCharacteristics(
  languageId: string,
  customCharacteristics?: Record<string, any>,
): ServerCharacteristics {
  // Use custom characteristics if provided
  if (customCharacteristics) {
    return {
      readinessCheckTimeout: customCharacteristics.readinessCheckTimeout || 500,
      supportsDidSave: customCharacteristics.supportsDidSave,
      requiresFileWatching: customCharacteristics.requiresFileWatching,
    };
  }

  // Default characteristics by language
  const defaults: Record<string, ServerCharacteristics> = {
    typescript: {
      readinessCheckTimeout: 1000,
      supportsDidSave: true,
    },
    javascript: {
      readinessCheckTimeout: 1000,
      supportsDidSave: true,
    },
    python: {
      readinessCheckTimeout: 2000,
      supportsDidSave: true,
    },
    rust: {
      readinessCheckTimeout: 3000,
      supportsDidSave: true,
      requiresFileWatching: true,
    },
    go: {
      readinessCheckTimeout: 1500,
      supportsDidSave: true,
    },
    default: {
      readinessCheckTimeout: 500,
    },
  };

  return defaults[languageId] || defaults.default;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
