import type { Diagnostic } from "./lspTypes.ts";
import type { LSPClient } from "./lspClient.ts";

export interface DiagnosticWaitOptions {
  timeout?: number;
  pollInterval?: number;
  maxPolls?: number;
  initialWait?: number;
  forceRefresh?: boolean;
  languageSpecific?: {
    moonbit?: { initialWait: number; maxPolls: number; timeout: number };
    deno?: { initialWait: number; maxPolls: number; timeout: number };
    default?: { initialWait: number; maxPolls: number; timeout: number };
  };
}

/**
 * Wait for diagnostics with language-specific retry logic
 * Unified implementation for both test and production use
 */
export async function waitForDiagnosticsWithRetry(
  client: LSPClient,
  fileUri: string,
  fileContent: string,
  languageId?: string,
  options: DiagnosticWaitOptions = {},
): Promise<Diagnostic[]> {
  const {
    timeout = 5000,
    pollInterval = 50,
    forceRefresh = false,
    languageSpecific = {},
  } = options;

  // Check if document needs refresh
  if (forceRefresh && client.isDocumentOpen(fileUri)) {
    client.closeDocument(fileUri);
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }

  // Open document if not already open
  if (!client.isDocumentOpen(fileUri)) {
    client.openDocument(fileUri, fileContent, languageId);
  } else {
    // Update document to ensure fresh content
    client.updateDocument(fileUri, fileContent, 2);
  }

  // Get language-specific settings
  const langSettings = getLanguageSettings(client.languageId, languageSpecific);
  const effectiveTimeout = langSettings.timeout || timeout;
  const initialWait = options.initialWait || langSettings.initialWait || 0;
  const maxPolls =
    options.maxPolls ||
    langSettings.maxPolls ||
    Math.floor(effectiveTimeout / pollInterval);

  // Initial wait if specified
  if (initialWait > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, initialWait));
  }

  let diagnostics: Diagnostic[] = [];

  // Try event-driven approach first (if waitForDiagnostics is available)
  if (client.waitForDiagnostics) {
    try {
      const eventTimeout = Math.min(effectiveTimeout * 0.6, 3000);
      diagnostics = await client.waitForDiagnostics(fileUri, eventTimeout);

      // Special handling for Deno (sends empty diagnostics first)
      if (client.languageId === "deno" && diagnostics.length === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
        const currentDiagnostics = client.getDiagnostics(fileUri) || [];
        if (currentDiagnostics.length > 0) {
          diagnostics = currentDiagnostics;
        }
      }
    } catch {
      // Fall back to polling
    }
  }

  // Try pull diagnostics if available and no diagnostics yet
  if (diagnostics.length === 0 && client.pullDiagnostics) {
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      diagnostics = await client.pullDiagnostics(fileUri);
    } catch {
      // Fall back to polling
    }
  }

  // Polling fallback
  if (diagnostics.length === 0) {
    for (let poll = 0; poll < maxPolls; poll++) {
      await new Promise<void>((resolve) => setTimeout(resolve, pollInterval));
      diagnostics = client.getDiagnostics(fileUri) || [];

      if (diagnostics.length > 0) {
        break;
      }

      // Force document update every few polls
      if (poll > 0 && poll % 3 === 0) {
        client.updateDocument(fileUri, fileContent, poll + 2);
      }
    }
  }

  return diagnostics;
}

/**
 * Get language-specific settings for diagnostics
 */
function getLanguageSettings(
  languageId: string | undefined,
  languageSpecific: DiagnosticWaitOptions["languageSpecific"] = {},
) {
  const defaults = {
    initialWait: 200,
    maxPolls: 60,
    timeout: 3000,
  };

  if (languageId === "moonbit" && languageSpecific.moonbit) {
    return languageSpecific.moonbit;
  }

  if (languageId === "deno" && languageSpecific.deno) {
    return languageSpecific.deno;
  }

  return languageSpecific.default || defaults;
}

/**
 * Check if file is large (affects timeout settings)
 */
export function isLargeFile(
  fileContent: string,
  threshold: number = 100,
): boolean {
  return fileContent.split("\n").length > threshold;
}
