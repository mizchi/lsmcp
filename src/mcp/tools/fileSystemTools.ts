import {
  createListDirTool,
  createFindFileTool,
  createSearchForPatternTool,
} from "./fileSystemToolsFactory.ts";

// Export default instances using Node.js filesystem
export const listDirTool = createListDirTool();
export const findFileTool = createFindFileTool();
export const searchForPatternTool = createSearchForPatternTool();
