import type { CompletionItem, Position } from "@lsmcp/types";
import type {
  CompletionParams,
  CompletionResult,
  LSPCommand,
} from "./types.ts";
import { isCompletionList } from "./types.ts";
import type { LSPClient } from "../protocol/types/index.ts";

export function createCompletionCommand(): LSPCommand<
  CompletionParams,
  CompletionItem[]
> {
  return {
    method: "textDocument/completion",

    buildParams(input: CompletionParams) {
      return {
        textDocument: { uri: input.uri },
        position: input.position,
      };
    },

    processResponse(response: CompletionResult): CompletionItem[] {
      if (!response) {
        return [];
      }

      // Handle CompletionList
      if (isCompletionList(response)) {
        return response.items;
      }

      // Handle CompletionItem[]
      if (Array.isArray(response)) {
        return response;
      }

      return [];
    },
  };
}

export function createCompletionResolveCommand(): LSPCommand<
  CompletionItem,
  CompletionItem
> {
  return {
    method: "completionItem/resolve",

    buildParams(input: CompletionItem) {
      return input;
    },

    processResponse(response: unknown): CompletionItem {
      // If resolve fails or returns null, return the original item
      return (response as CompletionItem) || ({} as CompletionItem);
    },
  };
}

/**
 * Completion handler interface
 */
export interface CompletionHandler {
  /**
   * Get completion items at a specific position
   */
  getCompletion(uri: string, position: Position): Promise<CompletionItem[]>;

  /**
   * Resolve a completion item for additional details
   */
  resolveCompletionItem(item: CompletionItem): Promise<CompletionItem>;
  
  /**
   * Get completions with optional auto-import filtering
   */
  getCompletionsWithImports(
    uri: string,
    position: Position,
    includeAutoImport?: boolean,
  ): Promise<CompletionItem[]>;
}

/**
 * Create a completion handler for the given LSP client
 */
export function createCompletionHandler(client: LSPClient): CompletionHandler {
  const completionCommand = createCompletionCommand();
  const resolveCommand = createCompletionResolveCommand();

  async function getCompletion(
    uri: string,
    position: Position,
  ): Promise<CompletionItem[]> {
    const params = completionCommand.buildParams({ uri, position });
    const result = await client.sendRequest<CompletionResult>(
      completionCommand.method,
      params as Record<string, unknown>,
    );
    return completionCommand.processResponse(result);
  }

  async function resolveCompletionItem(
    item: CompletionItem,
  ): Promise<CompletionItem> {
    try {
      const params = resolveCommand.buildParams(item);
      const result = await client.sendRequest<CompletionItem>(
        resolveCommand.method,
        params as Record<string, unknown>,
      );
      return resolveCommand.processResponse(result) || item;
    } catch {
      // If resolve fails, return the original item
      return item;
    }
  }

  async function getCompletionsWithImports(
    uri: string,
    position: Position,
    includeAutoImport: boolean = true,
  ): Promise<CompletionItem[]> {
    const items = await getCompletion(uri, position);
    
    if (!includeAutoImport) {
      // Filter out auto-import completions
      return items.filter(item => {
        // Check if the item is an auto-import
        const detail = item.detail || '';
        const documentation = typeof item.documentation === 'string' 
          ? item.documentation 
          : item.documentation?.value || '';
        
        return !detail.includes('Auto import') && 
               !documentation.includes('Auto import');
      });
    }
    
    return items;
  }

  return {
    getCompletion,
    resolveCompletionItem,
    getCompletionsWithImports,
  };
}


