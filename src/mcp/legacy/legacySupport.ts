/**
 * Legacy support functions for backward compatibility
 */

import type { LanguageConfig, LspAdapter } from "../../types.ts";
import type { AdapterRegistry } from "../../core/config/configLoader.ts";

// Legacy support - will be removed in future versions
const languages = new Map<string, LanguageConfig>();

export function getLanguage(
  id: string,
  adapterRegistry: AdapterRegistry,
): LanguageConfig | undefined {
  const lang = languages.get(id);
  if (lang) return lang;

  const adapter = adapterRegistry.get(id);
  if (adapter) return adapterToLanguageConfig(adapter);

  return undefined;
}

export function listLanguages(): LanguageConfig[] {
  return Array.from(languages.values());
}

export function listAdapters(adapterRegistry: AdapterRegistry): LspAdapter[] {
  return adapterRegistry.list();
}

export function adapterToLanguageConfig(adapter: LspAdapter): LanguageConfig {
  return {
    id: adapter.id,
    name: adapter.name,
    bin: adapter.bin,
    args: adapter.args,
    initializationOptions: adapter.initializationOptions,
  };
}

export function loadLanguageFromJson(json: any): LanguageConfig {
  return adapterToLanguageConfig(json);
}

export function setLanguage(id: string, config: LanguageConfig): void {
  languages.set(id, config);
}
