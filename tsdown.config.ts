import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    lsmcp: "src/cli/lsmcp.ts",
  },
  define: {
    "import.meta.vitest": "undefined",
  },
});
