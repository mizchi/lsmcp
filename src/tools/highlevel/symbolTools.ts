import {
  createGetSymbolsOverviewTool,
  getFilesRecursively,
} from "./symbolToolsFactory.ts";

// Export for backward compatibility and testing
export { getFilesRecursively };

// Create default instances with node filesystem
export const getSymbolsOverviewTool = createGetSymbolsOverviewTool();
// querySymbolsTool removed - functionality now in search_symbols tool
