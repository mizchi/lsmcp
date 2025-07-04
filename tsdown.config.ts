import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    lsmcp: "src/mcp/lsmcp.ts",
  },
  define: {
    "import.meta.vitest": "undefined",
  },
});
