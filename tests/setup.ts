import { beforeAll } from "vitest";
import { findNodeModulesBin } from "../src/ts/utils/findNodeModulesBin.js";

// Set up environment variables for all tests
beforeAll(() => {
  // Find typescript-language-server in node_modules for faster test execution
  const tsLanguageServerPath = findNodeModulesBin(
    __dirname,
    "typescript-language-server",
  );
  if (tsLanguageServerPath) {
    process.env.TYPESCRIPT_LANGUAGE_SERVER_PATH = tsLanguageServerPath;
  }

  // Set project root for finding binaries
  process.env.LSMCP_PROJECT_ROOT = process.cwd();
});
