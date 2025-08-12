import { CompletionItem } from "@lsmcp/types";

export interface AdvancedCompletionHandlerOptions {
  includeAutoImport?: boolean;
  resolve?: boolean;
}

export function createAdvancedCompletionHandler(
  options: AdvancedCompletionHandlerOptions = {},
) {
  return {
    processCompletionItems: (items: CompletionItem[]): CompletionItem[] => {
      // Process and filter completion items based on options
      if (!options.includeAutoImport) {
        items = items.filter((item) => !isAutoImportItem(item));
      }

      if (options.resolve) {
        // In a real implementation, this would resolve additional details
        // For now, just return the items as-is
      }

      return items;
    },
  };
}

function isAutoImportItem(item: CompletionItem): boolean {
  // Check if the completion item is an auto-import suggestion
  return (
    item.detail?.includes("Auto import") ||
    item.labelDetails?.description?.includes("import") ||
    false
  );
}
