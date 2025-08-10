/**
 * Register all external library providers
 */

import { ExternalLibraryProviderFactory } from "./externalLibraryInterface.ts";
import { RustExternalLibraryProvider } from "./rustExternalLibraryProviderImpl.ts";
import { GoExternalLibraryProvider } from "./goExternalLibraryProviderImpl.ts";

/**
 * Register all available external library providers
 */
export function registerExternalLibraryProviders(): void {
  // Register Rust provider
  ExternalLibraryProviderFactory.register(new RustExternalLibraryProvider());

  // Register Go provider
  ExternalLibraryProviderFactory.register(new GoExternalLibraryProvider());

  // TypeScript provider is already implemented separately
  // Can be migrated to this interface in the future

  console.log("Registered external library providers for: Rust, Go");
}

/**
 * Get provider for current project
 */
export async function getProviderForProject(rootPath: string) {
  return await ExternalLibraryProviderFactory.detectProvider(rootPath);
}
