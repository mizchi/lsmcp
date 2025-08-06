import {
  createGetSymbolsOverviewTool,
  createQuerySymbolsTool,
  getFilesRecursively,
} from "./symbolToolsFactory.ts";

// Export for backward compatibility and testing
export { getFilesRecursively };

// Create default instances with node filesystem
export const getSymbolsOverviewTool = createGetSymbolsOverviewTool();
export const querySymbolsTool = createQuerySymbolsTool();
