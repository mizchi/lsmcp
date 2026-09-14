import { describe, it, expect } from "vitest";
import { typescriptAdapter } from "./typescript-language-server.ts";

describe("typescriptAdapter", () => {
  it("probes the nearest tsc --lsp, then a global one, falling back to typescript-language-server", () => {
    const languageServer = [
      { type: "node_modules", names: ["typescript-language-server"] },
      { type: "global", names: ["typescript-language-server"] },
      { type: "npx", package: "typescript-language-server" },
    ];
    expect(typescriptAdapter.binFindStrategy?.strategies).toEqual([
      {
        type: "node_modules",
        names: ["tsc"],
        args: ["--lsp", "--stdio"],
        ifFail: languageServer,
      },
      {
        type: "global",
        names: ["tsc"],
        args: ["--lsp", "--stdio"],
        ifFail: languageServer,
      },
      ...languageServer,
    ]);
    expect(typescriptAdapter.binFindStrategy?.defaultArgs).toEqual(["--stdio"]);
  });
});
